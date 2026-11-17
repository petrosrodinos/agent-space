import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  /** Dismiss this warning and return to the form. */
  onKeepEditing: () => void;
  /** Throw the changes away and close the underlying modal. */
  onDiscard: () => void;
  title?: string;
  description?: string;
  keepEditingText?: string;
  discardText?: string;
}

/** Warning shown when closing a modal whose form has unsaved changes. Use with `useUnsavedChangesGuard`. */
const UnsavedChangesDialog = ({ isOpen, onKeepEditing, onDiscard, title = "Unsaved changes", description = "You have unsaved changes. If you close now, they will be lost.", keepEditingText = "Keep editing", discardText = "Discard changes" }: UnsavedChangesDialogProps) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onKeepEditing()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-left">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-left">{description}</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onKeepEditing}>
          {keepEditingText}
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          {discardText}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default UnsavedChangesDialog;
