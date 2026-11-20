import { Capacitor } from "@capacitor/core";
import { CapacitorShareTarget, type ShareReceivedEvent } from "@capgo/capacitor-share-target";

/**
 * Share-to-bot (§14.2): text, links, images and PDFs shared from other apps. The Android intent filter is in
 * AndroidManifest.xml; @capgo/capacitor-share-target copies shared files into the app cache and reports them here.
 * Shares are kept until the app shell picks them up (a cold start can arrive before anyone listens).
 */
export interface SharedItem {
  /** Text and links, joined with blank lines. */
  text: string;
  files: SharedFile[];
}

export interface SharedFile {
  name: string;
  mimeType: string;
  /** Absolute path or URI of the copy in the app's cache. */
  path: string;
}

/** The share plugin's event name. */
const SHARE_RECEIVED = "shareReceived" as const;
/** Missing in app builds made before the share plugin was added (web-only updates can run in them). */
const SHARE_TARGET_PLUGIN = "CapacitorShareTarget";

let pending: SharedItem | null = null;
const listeners = new Set<(item: SharedItem) => void>();

const toItem = (e: ShareReceivedEvent): SharedItem => ({
  text: [e.title, ...(e.texts ?? [])].map((t) => t?.trim()).filter(Boolean).join("\n\n"),
  files: (e.files ?? []).map((f) => ({ name: f.name, mimeType: f.mimeType, path: f.uri })),
});

/** Starts listening for shares (called once by the native platform at start-up). */
export function initShareTarget() {
  if (!Capacitor.isPluginAvailable(SHARE_TARGET_PLUGIN)) return;
  void CapacitorShareTarget.addListener(SHARE_RECEIVED, (e) => {
    const item = toItem(e);
    if (!item.text && !item.files.length) return;
    if (listeners.size) listeners.forEach((cb) => cb(item));
    else pending = item;
  });
}

/** Subscribes to shares; a share that arrived before anyone listened is delivered straight away. */
export function onShareReceived(cb: (item: SharedItem) => void): () => void {
  listeners.add(cb);
  if (pending) {
    const item = pending;
    pending = null;
    cb(item);
  }
  return () => {
    listeners.delete(cb);
  };
}

/** Reads a shared file into a File for uploading. */
export async function readSharedFile(f: SharedFile): Promise<File> {
  const res = await fetch(Capacitor.convertFileSrc(f.path));
  if (!res.ok) throw new Error(`Could not read ${f.name}`);
  return new File([await res.blob()], f.name, { type: f.mimeType || "application/octet-stream" });
}
