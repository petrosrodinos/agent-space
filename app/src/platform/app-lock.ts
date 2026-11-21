/* App lock (PIN + optional fingerprint / face). Lives in src/platform because it touches WebCrypto, storage and the biometric plugin. */
import { platform } from "./index";
import { BiometricResults, nativeBiometric } from "./native";

const PIN_KEY = "agentspace.app_lock.pin";
const BIOMETRIC_KEY = "agentspace.app_lock.biometric";
const PBKDF2_ITERATIONS = 150_000;

export const PIN_LENGTH = { MIN: 4, MAX: 8 } as const;
export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH.MIN},${PIN_LENGTH.MAX}}$`).test(pin);

interface StoredPin {
  salt: string;
  hash: string;
}

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf as ArrayBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}

function readStored(): StoredPin | null {
  const raw = platform.storage.get(PIN_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredPin;
    return v.salt && v.hash ? v : null;
  } catch {
    return null;
  }
}

export const appLock = {
  hasPin: (): boolean => readStored() !== null,

  setPin: async (pin: string): Promise<void> => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    platform.storage.set(PIN_KEY, JSON.stringify({ salt: toHex(salt), hash: await derive(pin, salt) } satisfies StoredPin));
  },

  verifyPin: async (pin: string): Promise<boolean> => {
    const stored = readStored();
    if (!stored) return false;
    return (await derive(pin, fromHex(stored.salt))) === stored.hash;
  },

  /** Removes the PIN and the biometric preference: the app no longer locks. */
  clear: (): void => {
    platform.storage.remove(PIN_KEY);
    platform.storage.remove(BIOMETRIC_KEY);
  },

  /** Fingerprint / face is offered in the Android app when the phone has it set up. */
  biometricSupported: async (): Promise<boolean> => platform.is("android") && (await nativeBiometric.available()),
  biometricEnabled: (): boolean => platform.storage.get(BIOMETRIC_KEY) === "1",
  setBiometricEnabled: (on: boolean): void => (on ? platform.storage.set(BIOMETRIC_KEY, "1") : platform.storage.remove(BIOMETRIC_KEY)),
  verifyBiometric: async (reason: string): Promise<boolean> => (await nativeBiometric.verify(reason)) === BiometricResults.VERIFIED,

  /** Fires `cb` when the app is hidden and again when it's shown, with how long it was away (ms). */
  onVisibility: (cb: (event: { hidden: boolean; awayMs: number }) => void): (() => void) => {
    let hiddenAt = 0;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        cb({ hidden: true, awayMs: 0 });
      } else {
        cb({ hidden: false, awayMs: hiddenAt ? Date.now() - hiddenAt : 0 });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },
};
