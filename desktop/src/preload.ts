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
});
