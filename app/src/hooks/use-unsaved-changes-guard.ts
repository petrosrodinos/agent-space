import { useCallback, useRef, useState } from "react";

interface UseUnsavedChangesGuardOptions {
  /** True when the modal's form has data or has been changed (e.g. react-hook-form `formState.isDirty`). */
  isDirty: boolean;
  /** Actually closes the modal (and should reset the form). Only called when closing is allowed. */
  onClose: () => void;
  /** Block closing entirely, e.g. while a mutation is in flight. */
  disabled?: boolean;
}

/**
 * Guards closing a modal that contains a form.
 * Wire `requestClose` to every close path (Dialog `onOpenChange`, Cancel button),
 * and spread `dialogProps` onto `<UnsavedChangesDialog />`.
 * `requestLeave(action)` guards any other way of leaving the form (e.g. a Back button) the same way.
 */
export const useUnsavedChangesGuard = ({ isDirty, onClose, disabled = false }: UseUnsavedChangesGuardOptions) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const pendingAction = useRef<() => void>(onClose);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (disabled) return;
      if (isDirty) {
        pendingAction.current = action;
        setIsConfirmOpen(true);
        return;
      }
      action();
    },
    [disabled, isDirty],
  );
  const requestClose = useCallback(() => requestLeave(onClose), [requestLeave, onClose]);

  const dialogProps = {
    isOpen: isConfirmOpen,
    onKeepEditing: () => setIsConfirmOpen(false),
    onDiscard: () => {
      setIsConfirmOpen(false);
      pendingAction.current();
    },
  };

  return { requestClose, requestLeave, dialogProps };
};
