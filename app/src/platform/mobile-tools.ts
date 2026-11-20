import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { AppLauncher } from "@capacitor/app-launcher";
import { Contacts } from "@capacitor-community/contacts";
import { DocumentScanner, GoogleDocumentScannerModuleInstallState } from "@capacitor-mlkit/document-scanner";
import { CapacitorCalendar, CalendarPermissionScope, type Calendar } from "@ebarooni/capacitor-calendar";
import { AgentSpaceNative, isAgentSpaceNativeAvailable } from "./mobile-native";
import {
  MobileToolKinds,
  type CalendarCreateArgs,
  type CalendarCreateResult,
  type CalendarEvent,
  type CalendarListArgs,
  type CalendarListResult,
  type ContactsSearchArgs,
  type ContactsSearchResult,
  type LocationResult,
  type MobileToolKind,
  type ScanArgs,
  type ScanResult,
  type SendViaAppArgs,
  type SendViaAppResult,
} from "./mobile-device-ops";

/**
 * The mobile device tools (§14.3) on Android, behind the contract in mobile-device-ops.ts. Each function asks for
 * the Android runtime permission it needs and throws an Error with a message the bot can relay. The Agent Space
 * "Ask each time" card is shown before these run (components/layout/mobile-device-host.tsx).
 */

/** The native plugin each tool needs (Capacitor registration names). */
const TOOL_PLUGINS: Record<MobileToolKind, string> = {
  [MobileToolKinds.CAMERA_SCANNER]: "Camera",
  [MobileToolKinds.CONTACTS]: "Contacts",
  [MobileToolKinds.SEND_VIA_APPS]: "AppLauncher",
  [MobileToolKinds.DEVICE_CALENDAR]: "CapacitorCalendar",
  [MobileToolKinds.LOCATION]: "Geolocation",
};

/**
 * Tools this app build supports (announced in `device:hello`): only those whose plugin is in the native build, since
 * a web-only update can run in an older build. Place-based triggers are not built (deferred).
 */
export const supportedMobileTools = (): MobileToolKind[] =>
  (Object.keys(TOOL_PLUGINS) as MobileToolKind[]).filter((kind) => Capacitor.isPluginAvailable(TOOL_PLUGINS[kind]));

const DOCUMENT_SCANNER_PLUGIN = "DocumentScanner";

const ScanModes = { PHOTO: "photo", DOCUMENT: "document" } as const;
const SendApps = { SMS: "sms", WHATSAPP: "whatsapp", EMAIL: "email", CALL: "call" } as const;
const GRANTED = "granted";
const LIMITED = "limited";

const LIMITS = {
  TEXT_CHARS: 20_000,
  IMAGE_EDGE_PX: 1600,
  JPEG_QUALITY: 0.85,
  PDF_BYTES: 8 * 1024 * 1024,
  SCAN_PAGES: 10,
  CONTACTS: 20,
  CONTACT_QUERY_DIGITS: 3,
  CALENDAR_EVENTS: 200,
  LOCATION_TIMEOUT_MS: 20_000,
  LOCATION_MAX_AGE_MS: 60_000,
  SCANNER_INSTALL_MS: 120_000,
} as const;

const isCancel = (e: unknown) => /cancel/i.test((e as Error)?.message ?? String(e));

const denied = (what: string) => new Error(`Agent Space doesn't have permission to use ${what} on this phone. The user can turn it on in the phone's Settings → Apps → Agent Space → Permissions.`);

// --- Images ---

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the picture"));
    img.src = src;
  });
}

/** JPEG data URL at most 1600 px on the longest side. */
async function toJpegDataUrl(uri: string): Promise<string> {
  const img = await loadImage(Capacitor.convertFileSrc(uri));
  const scale = Math.min(1, LIMITS.IMAGE_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", LIMITS.JPEG_QUALITY);
}

async function toBase64(uri: string): Promise<{ base64: string; bytes: number }> {
  const blob = await (await fetch(Capacitor.convertFileSrc(uri))).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the scan"));
    reader.readAsDataURL(blob);
  });
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), bytes: blob.size };
}

async function recognize(uris: string[]): Promise<string | undefined> {
  if (!isAgentSpaceNativeAvailable()) return undefined;
  const parts: string[] = [];
  for (const path of uris) {
    const { text } = await AgentSpaceNative.recognizeText({ path }).catch(() => ({ text: "" }));
    if (text) parts.push(text);
  }
  const all = parts.join("\n\n").trim();
  return all ? all.slice(0, LIMITS.TEXT_CHARS) : undefined;
}

// --- CAMERA_SCANNER ---

async function ensureScannerModule() {
  const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
  if (available) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("The document scanner is still downloading. Try again in a minute.")), LIMITS.SCANNER_INSTALL_MS);
    const handle = DocumentScanner.addListener("googleDocumentScannerModuleInstallProgress", (e) => {
      if (e.state === GoogleDocumentScannerModuleInstallState.COMPLETED) done();
      else if (e.state === GoogleDocumentScannerModuleInstallState.FAILED || e.state === GoogleDocumentScannerModuleInstallState.CANCELED) done(new Error("Could not install the phone's document scanner."));
    });
    const done = (err?: Error) => {
      clearTimeout(timer);
      void handle.then((h) => h.remove());
      if (err) reject(err);
      else resolve();
    };
    DocumentScanner.installGoogleDocumentScannerModule().catch((e: Error) => done(e));
  });
}

async function scanPhoto(): Promise<ScanResult> {
  const perm = await Camera.requestPermissions({ permissions: ["camera"] });
  if (perm.camera !== GRANTED && perm.camera !== LIMITED) throw denied("the camera");
  let uri: string | undefined;
  try {
    const photo = await Camera.takePhoto({ quality: 90, correctOrientation: true });
    uri = photo.uri ?? photo.webPath;
  } catch (e) {
    if (isCancel(e)) return { cancelled: true };
    throw e;
  }
  if (!uri) return { cancelled: true };
  return { image: await toJpegDataUrl(uri), text: await recognize([uri]) };
}

async function scanDocument(): Promise<ScanResult> {
  // Older builds without the scanner: fall back to a plain photo.
  if (!Capacitor.isPluginAvailable(DOCUMENT_SCANNER_PLUGIN)) return scanPhoto();
  await ensureScannerModule();
  let result: Awaited<ReturnType<typeof DocumentScanner.scanDocument>>;
  try {
    result = await DocumentScanner.scanDocument({ galleryImportAllowed: false, pageLimit: LIMITS.SCAN_PAGES, resultFormats: "JPEG_PDF", scannerMode: "FULL" });
  } catch (e) {
    if (isCancel(e)) return { cancelled: true };
    throw e;
  }
  const pages = result.scannedImages ?? [];
  if (!pages.length && !result.pdf) return { cancelled: true };
  const out: ScanResult = { pages: result.pdf?.pageCount ?? pages.length };
  if (pages[0]) out.image = await toJpegDataUrl(pages[0]);
  out.text = await recognize(pages);
  if (result.pdf && (out.pages ?? 0) > 1) {
    const pdf = await toBase64(result.pdf.uri);
    if (pdf.bytes <= LIMITS.PDF_BYTES) out.pdf_base64 = pdf.base64;
  }
  return out;
}

export const scan = (args: ScanArgs): Promise<ScanResult> => (args.mode === ScanModes.DOCUMENT ? scanDocument() : scanPhoto());

// --- CONTACTS ---

const digits = (s: string) => s.replace(/\D/g, "");

export async function searchContacts(args: ContactsSearchArgs): Promise<ContactsSearchResult> {
  const query = String(args.query ?? "").trim().toLowerCase();
  if (!query) throw new Error("Say who to look for (a name, number or email).");
  const perm = await Contacts.requestPermissions();
  if (perm.contacts !== GRANTED && perm.contacts !== LIMITED) throw denied("Contacts");
  // Only names, numbers and emails are read, and only the matches leave the phone.
  const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true, emails: true } });
  const queryDigits = digits(query);
  const matches: ContactsSearchResult["contacts"] = [];
  for (const c of contacts) {
    const name = c.name?.display ?? [c.name?.given, c.name?.family].filter(Boolean).join(" ");
    const phones = (c.phones ?? []).map((p) => p.number ?? "").filter(Boolean);
    const emails = (c.emails ?? []).map((e) => e.address ?? "").filter(Boolean);
    const hit =
      name.toLowerCase().includes(query) ||
      emails.some((e) => e.toLowerCase().includes(query)) ||
      (queryDigits.length >= LIMITS.CONTACT_QUERY_DIGITS && phones.some((p) => digits(p).includes(queryDigits)));
    if (!hit) continue;
    matches.push({ name: name || emails[0] || phones[0] || "Unnamed", phones, emails });
    if (matches.length >= LIMITS.CONTACTS) break;
  }
  return { contacts: matches };
}

// --- SEND_VIA_APPS ---

function sendUrl(args: SendViaAppArgs): string {
  const to = String(args.to ?? "").trim();
  const body = args.body ?? "";
  const q = (params: Record<string, string | undefined>) => {
    const s = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return s ? `?${s}` : "";
  };
  switch (args.app) {
    case SendApps.SMS:
      return `sms:${encodeURIComponent(to)}${q({ body })}`;
    case SendApps.WHATSAPP:
      if (!digits(to)) throw new Error("WhatsApp needs a phone number with the country code.");
      return `https://wa.me/${digits(to)}${q({ text: body })}`;
    case SendApps.EMAIL:
      return `mailto:${encodeURIComponent(to)}${q({ subject: args.subject, body })}`;
    case SendApps.CALL:
      return `tel:${encodeURIComponent(to)}`;
    default:
      throw new Error(`Can't open "${String(args.app)}". Use sms, whatsapp, email or call.`);
  }
}

/** Opens the app with everything filled in; the user taps Send (or Call) themselves. Never sends by itself. */
export async function sendViaApp(args: SendViaAppArgs): Promise<SendViaAppResult> {
  if (!String(args.to ?? "").trim()) throw new Error("Say who to send it to (a phone number or email address).");
  const { completed } = await AppLauncher.openUrl({ url: sendUrl(args) });
  if (!completed) throw new Error(`No app on this phone can open this ${args.app === SendApps.EMAIL ? "email" : args.app === SendApps.CALL ? "call" : "message"}.`);
  return { opened: true };
}

// --- DEVICE_CALENDAR ---

async function calendarPermission(scope: CalendarPermissionScope) {
  const { result } = await CapacitorCalendar.requestPermission({ scope });
  if (result !== GRANTED) throw denied("the calendar");
}

const parseTime = (iso: string, field: string) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`"${field}" must be an ISO date-time.`);
  return t;
};

export async function listCalendarEvents(args: CalendarListArgs): Promise<CalendarListResult> {
  const from = parseTime(args.from, "from");
  const to = parseTime(args.to, "to");
  await calendarPermission(CalendarPermissionScope.READ_CALENDAR);
  const [{ result: calendars }, { result: events }] = await Promise.all([CapacitorCalendar.listCalendars(), CapacitorCalendar.listEventsInRange({ from, to })]);
  const names = new Map(calendars.map((c: Calendar) => [c.id, c.title ?? c.internalTitle ?? ""]));
  return {
    events: events
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, LIMITS.CALENDAR_EVENTS)
      .map(
        (e): CalendarEvent => ({
          id: e.id,
          calendar: (e.calendarId && names.get(e.calendarId)) || "",
          title: e.title,
          start: new Date(e.startDate).toISOString(),
          end: new Date(e.endDate).toISOString(),
          all_day: e.isAllDay,
          ...(e.location ? { location: e.location } : {}),
          ...(e.description ? { notes: e.description } : {}),
        }),
      ),
  };
}

export async function createCalendarEvent(args: CalendarCreateArgs): Promise<CalendarCreateResult> {
  const title = String(args.title ?? "").trim();
  if (!title) throw new Error("The event needs a title.");
  const startDate = parseTime(args.start, "start");
  const endDate = parseTime(args.end, "end");
  if (endDate < startDate) throw new Error("The event ends before it starts.");
  await calendarPermission(CalendarPermissionScope.WRITE_CALENDAR);
  let calendarId: string | undefined;
  if (args.calendar) {
    const wanted = args.calendar.trim().toLowerCase();
    const { result } = await CapacitorCalendar.listCalendars();
    const match = result.find((c) => (c.title ?? c.internalTitle ?? "").toLowerCase() === wanted && c.allowsContentModifications !== false);
    if (!match) throw new Error(`There's no calendar called "${args.calendar}" on this phone that can be changed.`);
    calendarId = match.id;
  }
  const remind = args.remind_minutes_before;
  const { id } = await CapacitorCalendar.createEvent({
    title,
    startDate,
    endDate,
    calendarId,
    location: args.location,
    description: args.notes,
    alerts: typeof remind === "number" && remind >= 0 ? [-Math.round(remind)] : undefined,
  });
  if (!id) throw new Error("The phone's calendar didn't save the event.");
  return { id };
}

// --- LOCATION ---

export async function currentLocation(): Promise<LocationResult> {
  const perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
  if (perm.location !== GRANTED && perm.coarseLocation !== GRANTED) throw denied("location");
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: LIMITS.LOCATION_TIMEOUT_MS, maximumAge: LIMITS.LOCATION_MAX_AGE_MS });
  // No address: there's no offline reverse-geocoding plugin, and sending the position elsewhere to look it up isn't wanted.
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_m: Math.round(pos.coords.accuracy) };
}
