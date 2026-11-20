/**
 * Local tool servers (§14.3): MCP servers started by the main process from the command the user entered, connected over
 * stdio. Started lazily on first use, kept running, restarted when their config changes, stopped when the app quits.
 * Environment values are stored encrypted (store.ts) and only their names are ever returned to the page.
 */
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { decryptValue, encryptValue, readDevice, updateDevice, type StoredToolServer } from './store';
import type { LocalTool, LocalToolServerConfig, LocalToolServerInput } from './types';

const CONNECT_TIMEOUT_MS = 30_000;
const LIST_TIMEOUT_MS = 30_000;
const CALL_TIMEOUT_MS = 60_000;
const MAX_SERVERS = 30;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

interface Running {
    signature: string;
    client: Client;
    transport: StdioClientTransport;
}

const running = new Map<string, Running>();
const starting = new Map<string, Promise<Running>>();

const toPublic = (s: StoredToolServer): LocalToolServerConfig => ({ id: s.id, name: s.name, command: s.command, args: [...s.args], envKeys: Object.keys(s.env).sort(), enabled: s.enabled });

/** Anything that changes how the process is started; a different signature means restart. */
const signature = (s: StoredToolServer) => JSON.stringify([s.command, s.args, s.env, s.enabled]);

export async function listToolServers(): Promise<LocalToolServerConfig[]> {
    return (await readDevice()).toolServers.map(toPublic);
}

function cleanInput(input: LocalToolServerInput) {
    const name = String(input?.name ?? '').trim().slice(0, 80);
    const command = String(input?.command ?? '').trim();
    if (!name) throw new Error('Give the tool server a name.');
    if (!command || command.length > 1000) throw new Error('Enter the command that starts the tool server.');
    const args = Array.isArray(input.args) ? input.args.map((a) => String(a)).slice(0, 100) : [];
    if (args.some((a) => a.length > 4000)) throw new Error('An argument is too long.');
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.env ?? {})) {
        if (!ENV_NAME.test(k)) throw new Error(`Invalid environment variable name: ${k}`);
        env[k] = String(v ?? '');
    }
    return { name, command, args, env, enabled: !!input.enabled };
}

export async function saveToolServer(input: LocalToolServerInput): Promise<LocalToolServerConfig[]> {
    const clean = cleanInput(input);
    let savedId = '';
    const s = await updateDevice((d) => {
        const existing = input.id ? d.toolServers.find((x) => x.id === input.id) : undefined;
        if (input.id && !existing) throw new Error('That tool server no longer exists.');
        if (!existing && d.toolServers.length >= MAX_SERVERS) throw new Error(`You can add up to ${MAX_SERVERS} local tool servers.`);
        const env = { ...(existing?.env ?? {}) };
        for (const [k, v] of Object.entries(clean.env)) {
            if (v === '') delete env[k];
            else env[k] = encryptValue(v);
        }
        const next: StoredToolServer = { id: existing?.id ?? randomUUID(), name: clean.name, command: clean.command, args: clean.args, env, enabled: clean.enabled };
        savedId = next.id;
        if (existing) d.toolServers[d.toolServers.indexOf(existing)] = next;
        else d.toolServers.push(next);
    });
    const saved = s.toolServers.find((x) => x.id === savedId);
    const run = running.get(savedId);
    if (run && (!saved || run.signature !== signature(saved))) await stopServer(savedId);
    return s.toolServers.map(toPublic);
}

export async function removeToolServer(id: string): Promise<LocalToolServerConfig[]> {
    await stopServer(String(id));
    const s = await updateDevice((d) => {
        d.toolServers = d.toolServers.filter((x) => x.id !== id);
    });
    return s.toolServers.map(toPublic);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${what} timed out.`)), ms);
        p.then(
            (v) => (clearTimeout(t), resolve(v)),
            (e) => (clearTimeout(t), reject(e)),
        );
    });
}

async function start(cfg: StoredToolServer): Promise<Running> {
    const env: Record<string, string> = { ...getDefaultEnvironment() };
    for (const [k, v] of Object.entries(cfg.env)) {
        try {
            env[k] = decryptValue(v);
        } catch {
            throw new Error(`Couldn't decrypt the stored value of ${k} for "${cfg.name}". Enter it again.`);
        }
    }
    const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args, env, stderr: 'ignore' });
    const client = new Client({ name: 'agent-space-desktop', version: app.getVersion() });
    const r: Running = { signature: signature(cfg), client, transport };
    transport.onclose = () => {
        if (running.get(cfg.id) === r) running.delete(cfg.id);
    };
    try {
        await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `Starting "${cfg.name}"`);
    } catch (e) {
        await client.close().catch(() => undefined);
        throw new Error(`Couldn't start the tool server "${cfg.name}": ${(e as Error).message}`);
    }
    running.set(cfg.id, r);
    return r;
}

async function ensureStarted(cfg: StoredToolServer): Promise<Running> {
    const r = running.get(cfg.id);
    if (r && r.signature === signature(cfg)) return r;
    if (r) await stopServer(cfg.id);
    let p = starting.get(cfg.id);
    if (!p) {
        p = start(cfg).finally(() => starting.delete(cfg.id));
        starting.set(cfg.id, p);
    }
    return p;
}

async function stopServer(id: string) {
    const r = running.get(id);
    running.delete(id);
    if (r) await r.client.close().catch(() => undefined);
}

export const hasRunningServers = () => running.size > 0;

export async function stopAllServers() {
    await Promise.all([...running.keys()].map(stopServer));
}

export async function listLocalTools(): Promise<LocalTool[]> {
    const servers = (await readDevice()).toolServers.filter((s) => s.enabled);
    const lists = await Promise.all(
        servers.map(async (cfg) => {
            try {
                const { client } = await ensureStarted(cfg);
                const out: LocalTool[] = [];
                let cursor: string | undefined;
                for (let page = 0; page < 20; page++) {
                    const res = await client.listTools(cursor ? { cursor } : undefined, { timeout: LIST_TIMEOUT_MS });
                    for (const t of res.tools) out.push({ serverId: cfg.id, serverName: cfg.name, name: t.name, description: t.description ?? '', inputSchema: (t.inputSchema ?? {}) as Record<string, unknown> });
                    cursor = res.nextCursor;
                    if (!cursor) break;
                }
                return out;
            } catch (e) {
                // One broken server must not hide the others' tools.
                console.warn(`[device] local tool server "${cfg.name}" unavailable:`, (e as Error).message);
                return [];
            }
        }),
    );
    return lists.flat();
}

export async function callLocalTool(serverId: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
    const cfg = (await readDevice()).toolServers.find((s) => s.id === serverId);
    if (!cfg) throw new Error('That local tool server no longer exists.');
    if (!cfg.enabled) throw new Error(`The local tool server "${cfg.name}" is turned off.`);
    if (typeof tool !== 'string' || !tool) throw new Error('Tool name is required.');
    const { client } = await ensureStarted(cfg);
    const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    return client.callTool({ name: tool, arguments: safeArgs }, undefined, { timeout: CALL_TIMEOUT_MS });
}
