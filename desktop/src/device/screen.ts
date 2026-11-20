/**
 * Look at my screen (§14.3) and the screenshots for control my computer. Uses desktopCapturer in the main process.
 * Agent Space's own windows are never offered as sources.
 */
import { BrowserWindow, desktopCapturer, nativeImage, screen, type Display, type NativeImage } from 'electron';
import { CAPTURE_MAX_WIDTH, fitWidth, physicalSize, screenshotSize } from './coords';
import type { CapturedImage, ScreenSource } from './types';

const SOURCE_ID = /^(screen|window):[\w:.-]{1,80}$/;

/** "window:1234:0" → "window:1234" so ids from getMediaSourceId and getSources compare reliably. */
const idKey = (id: string) => id.split(':').slice(0, 2).join(':');

function ownWindowIds(): Set<string> {
    const ids = new Set<string>();
    for (const w of BrowserWindow.getAllWindows()) {
        try {
            ids.add(idKey(w.getMediaSourceId()));
        } catch {
            /* destroyed */
        }
    }
    return ids;
}

const toCaptured = (img: NativeImage): CapturedImage => {
    const { width, height } = img.getSize();
    return { dataUrl: `data:image/png;base64,${img.toPNG().toString('base64')}`, width, height };
};

function largestDisplaySize() {
    return screen.getAllDisplays().reduce((acc, d) => {
        const s = physicalSize(d);
        return { width: Math.max(acc.width, s.width), height: Math.max(acc.height, s.height) };
    }, { width: 1, height: 1 });
}

export async function screenSources(): Promise<ScreenSource[]> {
    const own = ownWindowIds();
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 200 } });
    return sources
        .filter((s) => !own.has(idKey(s.id)))
        .map((s) => ({ id: s.id, name: s.name, kind: s.id.startsWith('screen:') ? 'screen' : 'window', thumbnail: s.thumbnail.toDataURL() }));
}

export async function captureSource(sourceId: string): Promise<CapturedImage> {
    const id = String(sourceId ?? '');
    if (!SOURCE_ID.test(id)) throw new Error('Invalid screen source.');
    if (ownWindowIds().has(idKey(id))) throw new Error("Agent Space's own windows can't be captured.");
    const isScreen = id.startsWith('screen:');
    const sources = await desktopCapturer.getSources({ types: [isScreen ? 'screen' : 'window'], thumbnailSize: largestDisplaySize() });
    let source = sources.find((s) => s.id === id) ?? sources.find((s) => idKey(s.id) === idKey(id));
    if (isScreen && source?.display_id) {
        // Re-capture at that display's exact pixel size so the picture is sharp.
        const d = screen.getAllDisplays().find((x) => String(x.id) === source!.display_id);
        if (d) {
            const exact = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: physicalSize(d) });
            source = exact.find((s) => s.id === source!.id) ?? source;
        }
    }
    if (!source || source.thumbnail.isEmpty()) throw new Error('That screen or window is no longer available.');
    const { width, height } = source.thumbnail.getSize();
    const target = fitWidth(width, height, CAPTURE_MAX_WIDTH);
    const img = target.width === width ? source.thumbnail : source.thumbnail.resize({ ...target, quality: 'good' });
    return toCaptured(img);
}

/**
 * Screenshot of one display at the size the bot works in (≤ 1280 px wide, see coords.ts).
 * `hideOverlays` runs around the capture; on macOS the border/bar are hidden briefly because content protection is not
 * honoured by every capture path there.
 */
export async function captureDisplay(display: Display, hideOverlays?: (hidden: boolean) => void): Promise<CapturedImage> {
    const shot = screenshotSize(display);
    const hide = process.platform === 'darwin' && hideOverlays;
    if (hide) {
        hideOverlays(true);
        await new Promise((r) => setTimeout(r, 60));
    }
    let sources;
    try {
        sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: physicalSize(display) });
    } finally {
        if (hide) hideOverlays(false);
    }
    const source = sources.find((s) => s.display_id === String(display.id)) ?? (sources.length === 1 ? sources[0] : undefined);
    if (!source || source.thumbnail.isEmpty()) throw new Error('Could not capture the screen. On Mac, allow Agent Space in System Settings → Privacy & Security → Screen Recording.');
    return toCaptured(source.thumbnail.resize({ width: shot.width, height: shot.height, quality: 'good' }));
}

/** A dark placeholder used instead of a screenshot when a blocked app is in front. */
export function placeholderImage(width = 320, height = 180): CapturedImage {
    const buf = Buffer.alloc(width * height * 4);
    for (let i = 0; i < buf.length; i += 4) {
        buf[i] = 0x20;
        buf[i + 1] = 0x20;
        buf[i + 2] = 0x20;
        buf[i + 3] = 0xff;
    }
    return toCaptured(nativeImage.createFromBitmap(buf, { width, height }));
}
