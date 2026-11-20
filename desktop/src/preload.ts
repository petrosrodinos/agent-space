/**
 * Typed preload bridge (§14.2): exposes `window.agentspaceDesktop` with plain-data methods only.
 * Mirrors app/src/platform/desktop-bridge.ts. Runs sandboxed — no Node APIs reach the page.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const info = ipcRenderer.sendSync('app:info') as { version: string; os: 'win32' | 'darwin' | 'linux'; deviceName: string };

function listen<T>(channel: string, cb: (v: T) => void) {
    const handler = (_e: IpcRendererEvent, v: T) => cb(v);
    ipcRenderer.on(channel, handler);
    return () => {
        ipcRenderer.removeListener(channel, handler);
    };
}

contextBridge.exposeInMainWorld('agentspaceDesktop', {
    version: info.version,
    os: info.os,
    deviceName: info.deviceName,
    getRefreshToken: () => ipcRenderer.invoke('token:get'),
    setRefreshToken: (token: string | null) => ipcRenderer.invoke('token:set', token),
    pickFiles: (options: { accept?: string; multiple?: boolean }) => ipcRenderer.invoke('files:pick', options ?? {}),
    download: (url: string) => ipcRenderer.invoke('files:download', url),
    notify: (n: { title: string; body?: string; tag?: string }) => ipcRenderer.invoke('notify', n),
    onNotificationClick: (cb: (tag: string | null) => void) => listen('notification-click', cb),
    clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard:write', text),
    clipboardRead: () => ipcRenderer.invoke('clipboard:read'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    onNavigate: (cb: (path: string) => void) => listen('navigate', cb),
    getLaunchAtStartup: () => ipcRenderer.invoke('startup:get'),
    setLaunchAtStartup: (on: boolean) => ipcRenderer.invoke('startup:set', on),
    getQuickAskShortcut: () => ipcRenderer.invoke('shortcut:get'),
    setQuickAskShortcut: (accelerator: string) => ipcRenderer.invoke('shortcut:set', accelerator),
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),
    getUpdateState: () => ipcRenderer.invoke('updates:state'),
    installUpdate: () => ipcRenderer.invoke('updates:install'),
    onUpdateState: (cb: (state: unknown) => void) => listen('updates:status', cb),
    // Device tools (§14.3): mirrors DeviceBridge in app/src/platform/device-bridge.ts; main re-checks everything.
    device: {
        capabilities: () => ipcRenderer.invoke('device:capabilities'),
        listFolders: () => ipcRenderer.invoke('device:listFolders'),
        addFolder: () => ipcRenderer.invoke('device:addFolder'),
        removeFolder: (path: string) => ipcRenderer.invoke('device:removeFolder', path),
        files: (req: unknown) => ipcRenderer.invoke('device:files', req),
        screenSources: () => ipcRenderer.invoke('device:screenSources'),
        captureSource: (sourceId: string) => ipcRenderer.invoke('device:captureSource', sourceId),
        open: (req: { kind: 'url' | 'path' | 'app'; target: string }) => ipcRenderer.invoke('device:open', req),
        listToolServers: () => ipcRenderer.invoke('device:listToolServers'),
        saveToolServer: (input: unknown) => ipcRenderer.invoke('device:saveToolServer', input),
        removeToolServer: (id: string) => ipcRenderer.invoke('device:removeToolServer', id),
        listLocalTools: () => ipcRenderer.invoke('device:listLocalTools'),
        callLocalTool: (serverId: string, tool: string, args: Record<string, unknown>) => ipcRenderer.invoke('device:callLocalTool', serverId, tool, args),
        displays: () => ipcRenderer.invoke('device:displays'),
        getBlockedApps: () => ipcRenderer.invoke('device:getBlockedApps'),
        setBlockedApps: (extra: string[]) => ipcRenderer.invoke('device:setBlockedApps', extra),
        beginControl: (req: { grantId: string; displayId: string; botName: string; task: string; expiresAt: number }) => ipcRenderer.invoke('device:beginControl', req),
        control: (grantId: string, req: unknown) => ipcRenderer.invoke('device:control', grantId, req),
        resumeControl: (grantId: string) => ipcRenderer.invoke('device:resumeControl', grantId),
        endControl: (grantId: string) => ipcRenderer.invoke('device:endControl', grantId),
        onControlEvent: (cb: (e: unknown) => void) => listen('device:control-event', cb),
    },
});
