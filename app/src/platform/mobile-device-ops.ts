/**
 * Mobile device tools (§14.3) — the calls the API sends to the Android app over the real-time connection
 * (`device:call` with `tool` + `op` + `args`) and what the app answers (`device:result` data). The API side is
 * api/src/modules/agent/tools/device-tools.service.ts; keep both in sync.
 */

/** Mirrors the API's DeviceToolKind (mobile subset). */
export const MobileToolKinds = {
  CAMERA_SCANNER: "CAMERA_SCANNER",
  CONTACTS: "CONTACTS",
  SEND_VIA_APPS: "SEND_VIA_APPS",
  DEVICE_CALENDAR: "DEVICE_CALENDAR",
  LOCATION: "LOCATION",
} as const;
export type MobileToolKind = (typeof MobileToolKinds)[keyof typeof MobileToolKinds];

export const MobileOps = {
  /** CAMERA_SCANNER — the user takes a photo or scans a document; the bot never uses the camera by itself. */
  SCAN: "scan",
  /** CONTACTS — search by name, number or email (never the whole address book). */
  CONTACTS_SEARCH: "contacts_search",
  /** SEND_VIA_APPS — open SMS / WhatsApp / email / phone with everything filled in; the user taps Send. */
  SEND_VIA_APP: "send_via_app",
  /** DEVICE_CALENDAR — calendars on the phone (including ones not connected in Agent Space). */
  CALENDAR_LIST: "calendar_list",
  CALENDAR_CREATE: "calendar_create",
  /** LOCATION — the current location once, when asked. */
  LOCATION_CURRENT: "location_current",
} as const;
export type MobileOp = (typeof MobileOps)[keyof typeof MobileOps];

export interface ScanArgs {
  /** "photo" (a picture) or "document" (edge-detected scan, can be several pages). */
  mode: "photo" | "document";
  /** Shown to the user: why the bot asks. */
  reason: string;
}
export interface ScanResult {
  cancelled?: boolean;
  /** Recognised text (ML Kit text recognition), trimmed to 20 000 characters. */
  text?: string;
  /** First page / the photo, JPEG data URL at most 1600 px on the longest side. */
  image?: string;
  /** Multi-page scans: the PDF, base64 (max 8 MB). */
  pdf_base64?: string;
  pages?: number;
}

export interface ContactsSearchArgs {
  query: string;
}
export interface ContactsSearchResult {
  /** At most 20 matches. */
  contacts: { name: string; phones: string[]; emails: string[] }[];
}

export interface SendViaAppArgs {
  app: "sms" | "whatsapp" | "email" | "call";
  /** Phone number (E.164 preferred) or email address. */
  to: string;
  subject?: string;
  body?: string;
}
export interface SendViaAppResult {
  /** The app opened with the message filled in; whether the user then sent it is unknown. */
  opened: boolean;
}

export interface CalendarListArgs {
  /** ISO date-times. */
  from: string;
  to: string;
}
export interface CalendarEvent {
  id: string;
  calendar: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  location?: string;
  notes?: string;
}
export interface CalendarListResult {
  events: CalendarEvent[];
}

export interface CalendarCreateArgs {
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  /** Minutes before the start for a reminder alert ("reminders" are events with an alert on Android). */
  remind_minutes_before?: number;
  /** Calendar name; default = the phone's default calendar. */
  calendar?: string;
}
export interface CalendarCreateResult {
  id: string;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  /** Street address when the phone could look it up. */
  address?: string;
}
