import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appLock, isValidPin, PIN_LENGTH } from "@/platform/app-lock";
import { AUTO_LOCK_AFTER_MS, useAppLockStore } from "@/stores/app-lock";

/** Full-screen lock shown over the app while the app lock is on and locked. Unlock with the PIN or fingerprint / face. */
export const AppLockScreen: FC = () => {
  const { enabled, locked, biometric, lock, unlock } = useAppLockStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompting = useRef(false);

  // Re-lock when the app returns after being away a while.
  useEffect(() => {
    if (!enabled) return;
    return appLock.onVisibility(({ hidden, awayMs }) => {
      if (!hidden && awayMs >= AUTO_LOCK_AFTER_MS) lock();
    });
  }, [enabled, lock]);

  const tryBiometric = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await appLock.verifyBiometric("Unlock Agent Space").finally(() => (prompting.current = false));
    if (ok) unlock();
  }, [unlock]);

  useEffect(() => {
    if (locked && biometric) void tryBiometric();
    if (!locked) {
      setPin("");
      setError(false);
    }
  }, [locked, biometric, tryBiometric]);

  if (!enabled || !locked) return null;

  const submit = async () => {
    if (!isValidPin(pin) || busy) return;
    setBusy(true);
    const ok = await appLock.verifyPin(pin).finally(() => setBusy(false));
    if (ok) unlock();
    else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="App locked" className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-ink">
        <Lock className="h-6 w-6" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">Agent Space is locked</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your PIN to continue.</p>
      </div>
      <form
        className="flex w-full max-w-xs flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={PIN_LENGTH.MAX}
          value={pin}
          aria-label="PIN"
          aria-invalid={error}
          className="text-center tracking-[0.4em]"
          onChange={(e) => {
            setError(false);
            setPin(e.target.value.replace(/\D/g, ""));
          }}
        />
        {error && <p className="text-center text-sm text-destructive">Wrong PIN. Try again.</p>}
        <Button type="submit" disabled={!isValidPin(pin)} loading={busy}>
          Unlock
        </Button>
        {biometric && (
          <Button type="button" variant="outline" onClick={() => void tryBiometric()}>
            <Fingerprint className="h-4 w-4" />
            Use fingerprint or face
          </Button>
        )}
      </form>
    </div>
  );
};
