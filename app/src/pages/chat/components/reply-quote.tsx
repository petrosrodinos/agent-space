import type { FC } from "react";
import { Paperclip, X } from "lucide-react";
import type { ReplyPreview } from "@/features/conversations/interfaces/conversations.interfaces";
import { cn } from "@/lib/utils";

export const ReplyQuoteVariants = { ON_PRIMARY: "on-primary", ON_SURFACE: "on-surface", COMPOSER: "composer" } as const;
export type ReplyQuoteVariant = (typeof ReplyQuoteVariants)[keyof typeof ReplyQuoteVariants];

const VARIANT_CLASSES: Record<ReplyQuoteVariant, { box: string; name: string; text: string }> = {
  [ReplyQuoteVariants.ON_PRIMARY]: { box: "border-primary-foreground/70 bg-primary-foreground/15 hover:bg-primary-foreground/25", name: "text-primary-foreground", text: "text-primary-foreground/85" },
  [ReplyQuoteVariants.ON_SURFACE]: { box: "border-primary bg-surface hover:bg-surface-soft", name: "text-primary", text: "text-body" },
  [ReplyQuoteVariants.COMPOSER]: { box: "border-primary bg-surface-soft", name: "text-primary", text: "text-body" },
};

interface Props {
  reply: ReplyPreview;
  meId: string;
  variant: ReplyQuoteVariant;
  /** Jump to the original message (message bubbles). */
  onJump?: (id: string) => void;
  /** Cancel the pending reply (composer). */
  onCancel?: () => void;
}

/** Quoted original shown above a reply, and above the composer while a reply is being written. */
export const ReplyQuote: FC<Props> = ({ reply, meId, variant, onJump, onCancel }) => {
  const styles = VARIANT_CLASSES[variant];
  const author = reply.author_user_id && reply.author_user_id === meId ? "You" : (reply.author_name ?? "Unknown");
  const text = reply.deleted ? "Message deleted" : reply.content?.trim() || (reply.has_files ? "Attachment" : "Message");
  const body = (
    <>
      <span className={cn("block truncate text-xs font-bold", styles.name)}>{author}</span>
      <span className={cn("flex items-center gap-1 text-[13px]", styles.text, reply.deleted && "italic opacity-80")}>
        {reply.has_files && !reply.deleted && <Paperclip className="h-3 w-3 shrink-0" aria-hidden />}
        <span className="line-clamp-2 break-words">{text}</span>
      </span>
    </>
  );
  const boxClass = cn("min-w-0 flex-1 rounded-[10px] border-l-[3px] px-2.5 py-1.5 text-left", styles.box);

  return (
    <div className="flex items-start gap-1.5">
      {onJump && !reply.deleted ? (
        <button type="button" onClick={() => onJump(reply.id)} className={cn(boxClass, "transition-colors")} aria-label={`Go to message from ${author}`}>
          {body}
        </button>
      ) : (
        <div className={boxClass}>{body}</div>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} aria-label="Cancel reply" className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
