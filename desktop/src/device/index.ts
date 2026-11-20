/**
 * Device tools IPC (§14.3): implements DeviceBridge (types.ts) for `window.agentspaceDesktop.device`.
 * Every handler runs main.ts's guard() first, so only the app page can call it. Channels: `device:<method>`, plus
 * `device:control-event` (main → page) for ControlEvents.
 */
import { app, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import originalFs from 'original-fs';
import path from 'path';
import { beginControl, control, controlAvailable, displays, endControl, getBlockedApps, registerControlBarIpc, resumeControl, setBlockedApps, stopControlOnQuit } from './control';
import { runFiles } from './files';
import { callLocalTool, hasRunningServers, listLocalTools, listToolServers, removeToolServer, saveToolServer, stopAllServers } from './mcp';
import { openTarget } from './open';
import { isInside, samePath, type Fs } from './paths';
import { captureSource, screenSources } from './screen';
import { readDevice, updateDevice } from './store';
import { DesktopToolKinds, type DesktopToolKind, type LocalFilesRequest } from './types';

/** Electron's patched fs treats .asar files as folders; device tools see the real filesystem. */
const realFs = originalFs.promises as unknown as Fs;

async function listFolders(): Promise<string[]> {
    return (await readDevice()).folders;
}

async function addFolder(win: BrowserWindow | null): Promise<string[]> {
    const opts = { title: 'Allow a folder for your bots', properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled || !r.filePaths[0]) return listFolders();
    const real = await realFs.realpath(r.filePaths[0]);
    const { root } = path.parse(real);
    if (samePath(real, root)) throw new Error('A whole drive can’t be allowed. Pick a folder instead.');
    const s = await updateDevice((d) => {
        if (d.folders.some((f) => samePath(f, real))) return;
        // A folder already inside an allowed one adds nothing.
        if (d.folders.some((f) => isInside(real, f))) return;
        d.folders = [...d.folders.filter((f) => !isInside(f, real)), real];
    });
    return s.folders;
}

async function removeFolder(p: string): Promise<string[]> {
    const s = await updateDevice((d) => {
        d.folders = d.folders.filter((f) => !samePath(f, String(p ?? '')));
    });
    return s.folders;
}

async function capabilities(): Promise<DesktopToolKind[]> {
    const out: DesktopToolKind[] = [DesktopToolKinds.LOCAL_FILES, DesktopToolKinds.SCREEN, DesktopToolKinds.LOCAL_TOOL_SERVERS, DesktopToolKinds.CLIPBOARD, DesktopToolKinds.OPEN];
    if (await controlAvailable()) out.push(DesktopToolKinds.CONTROL_COMPUTER);
    return out;
}

export function registerDeviceIpc(getWin: () => BrowserWindow | null, guard: (e: IpcMainInvokeEvent) => void) {
    const handle = <A extends unknown[], R>(name: string, fn: (...args: A) => R | Promise<R>) =>
        ipcMain.handle(`device:${name}`, async (e, ...args) => {
            guard(e);
            return fn(...(args as A));
        });

    handle('capabilities', capabilities);
    handle('listFolders', listFolders);
    handle('addFolder', () => addFolder(getWin()));
    handle('removeFolder', (p: string) => removeFolder(p));
    handle('files', async (req: LocalFilesRequest) => runFiles(req, await listFolders(), { fs: realFs, trash: (p) => shell.trashItem(p) }));
    handle('screenSources', screenSources);
    handle('captureSource', (id: string) => captureSource(id));
    handle('open', async (req: { kind: 'url' | 'path' | 'app'; target: string }) => openTarget(req, await listFolders()));
    handle('listToolServers', listToolServers);
    handle('saveToolServer', saveToolServer);
    handle('removeToolServer', (id: string) => removeToolServer(id));
    handle('listLocalTools', listLocalTools);
    handle('callLocalTool', (serverId: string, tool: string, args: Record<string, unknown>) => callLocalTool(String(serverId), tool, args));
    handle('displays', displays);
    handle('getBlockedApps', getBlockedApps);
    handle('setBlockedApps', (extra: string[]) => setBlockedApps(extra));
    handle('beginControl', (req: { grantId: string; displayId: string; botName: string; task: string; expiresAt: number }) => beginControl(req, getWin));
    handle('control', (grantId: string, req) => control(grantId, req as Parameters<typeof control>[1]));
    handle('resumeControl', (grantId: string) => resumeControl(grantId));
    handle('endControl', (grantId: string) => endControl(grantId));

    registerControlBarIpc();

    let stopping = false;
    app.on('will-quit', (e) => {
        stopControlOnQuit();
        // Give local tool servers a moment to shut down cleanly; only delays quitting when some are running.
        if (stopping || !hasRunningServers()) return;
        stopping = true;
        e.preventDefault();
        void Promise.race([stopAllServers(), new Promise((r) => setTimeout(r, 3000))]).finally(() => app.quit());
    });
}
