import { useEffect, useState, type FC } from "react";
import { Fingerprint, KeyRound, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingRow, SettingsCard } from "@/components/ui/setting-row";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { appLock, isValidPin, PIN_LENGTH } from "@/platform/app-lock";
import { useAppLockStore } from "@/stores/app-lock";

const LockDialogs = { NONE: "none", SET: "set", REMOVE: "remove" } as const;
type LockDialog = (typeof LockDialogs)[keyof typeof LockDialogs];

const digits = (v: string) => v.replace(/\D/g, "");

const PinInput: FC<{ label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }> = ({ label, value, onChange, autoFocus }) => (
  <Input type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH.MAX} aria-label={label} placeholder={label} autoFocus={autoFocus} value={value} onChange={(e) => onChange(digits(e.target.value))} />
);

/** Settings → Security: turn the app lock on (PIN, plus fingerprint / face where the phone has it), change it, or remove it. */
export const AppLockCard: FC = () => {
  const { enabled, biometric, refresh } = useAppLockStore();
  const [dialog, setDialog] = useState<LockDialog>(LockDialogs.NONE);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    void appLock.biometricSupported().then(setBiometricSupported);
  }, []);

  const close = () => {
    setDialog(LockDialogs.NONE);
    setCurrent("");
    setPin("");
    setConfirm("");
    setError(null);
  };

  const save = async () => {
    if (!isValidPin(pin)) return setError(`Use ${PIN_LENGTH.MIN} to ${PIN_LENGTH.MAX} digits.`);
    if (pin !== confirm) return setError("The PINs don't match.");
    setBusy(true);
    // Changing an existing PIN needs the current one.
    if (enabled && !(await appLock.verifyPin(current))) {
      setBusy(false);
      return setError("Your current PIN is wrong.");
    }
    await appLock.setPin(pin).finally(() => setBusy(false));
    refresh();
    toast({ title: enabled ? "PIN changed" : "App lock is on" });
    close();
  };

  const remove = async () => {
    setBusy(true);
    const ok = await appLock.verifyPin(current).finally(() => setBusy(false));
    if (!ok) return setError("Wrong PIN.");
    appLock.clear();
    refresh();
    toast({ title: "App lock removed" });
    close();
  };

  const toggleBiometric = async (on: boolean) => {
    if (on && !(await appLock.verifyBiometric("Turn on fingerprint or face unlock"))) {
      toast({ title: "Couldn't verify it's you", variant: "error" });
      return;
    }
    appLock.setBiometricEnabled(on);
    refresh();
  };

  return (
    <>
      <SettingsCard title="App lock" description="Ask for a PIN when you open Agent Space or come back to it after a while.">
        <SettingRow label="PIN" description={enabled ? "The app is locked with a PIN." : "Not set. Anyone with this device can open the app."}>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialog(LockDialogs.SET)}>
              {enabled ? <KeyRound /> : <Lock />}
              {enabled ? "Change PIN" : "Set a PIN"}
            </Button>
            {enabled && (
              <Button variant="outline" onClick={() => setDialog(LockDialogs.REMOVE)}>
                <Trash2 /> Remove
              </Button>
            )}
          </div>
        </SettingRow>
        {enabled && biometricSupported && (
          <SettingRow label="Fingerprint or face" description="Unlock with your phone's fingerprint or face instead of typing the PIN.">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-muted-foreground" />
              <Switch checked={biometric} onCheckedChange={(on) => void toggleBiometric(on)} aria-label="Fingerprint or face unlock" />
            </div>
          </SettingRow>
        )}
      </SettingsCard>

      <Dialog open={dialog === LockDialogs.SET} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{enabled ? "Change PIN" : "Set a PIN"}</DialogTitle>
            <DialogDescription>
              {PIN_LENGTH.MIN} to {PIN_LENGTH.MAX} digits. It stays on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {enabled && <PinInput label="Current PIN" value={current} onChange={setCurrent} autoFocus />}
            <PinInput label="New PIN" value={pin} onChange={setPin} autoFocus={!enabled} />
            <PinInput label="Confirm new PIN" value={confirm} onChange={setConfirm} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!pin || !confirm || (enabled && !current)}>
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === LockDialogs.REMOVE} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove app lock?</DialogTitle>
            <DialogDescription>Enter your PIN to confirm. Fingerprint and face unlock turn off too.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <PinInput label="Current PIN" value={current} onChange={setCurrent} autoFocus />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} loading={busy} disabled={!current}>
              Remove lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
