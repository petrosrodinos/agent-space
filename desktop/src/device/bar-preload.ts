/**
 * Preload for the "<bot> is using your computer" bar (control.ts). It can only send pause / stop / hand back and receive
 * the bar's state; nothing else reaches the bar page.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const ACTIONS = ['pause', 'stop', 'handback'];

contextBridge.exposeInMainWorld('controlBar', {
    send: (action: string) => {
        if (ACTIONS.includes(action)) ipcRenderer.send('control-bar:action', action);
    },
    onState: (cb: (s: { botName: string; state: string; note?: string }) => void) => {
        ipcRenderer.on('control-bar:state', (_e: IpcRendererEvent, s: { botName: string; state: string; note?: string }) => cb(s));
    },
});
