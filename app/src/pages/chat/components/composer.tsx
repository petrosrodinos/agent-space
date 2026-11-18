import { useCallback, useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent } from "react";
import { ArrowUp, AudioLines, Loader2, Paperclip, Square, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BotAvatar, PersonAvatar } from "@/components/ui/bot-avatar";
import { uploadFile, type StoredFile } from "@/features/files/services/files.services";
import { useSkills } from "@/features/skills/hooks/use-skills";
import type { Conversation, Message } from "@/features/conversations/interfaces/conversations.interfaces";
import { replyPreviewOf } from "@/features/conversations/utils/messages-cache";
import { findSecrets, guessService, stripSecrets } from "@/lib/secret-detection";
import { formatBytes } from "@/lib/date";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { StoreSecretDialog } from "./store-secret-dialog";
import { ReplyQuote, ReplyQuoteVariants } from "./reply-quote";
import { ConversationTypes, ATTACHMENT_ONLY_CONTENT } from "@/features/conversations/interfaces/conversations.interfaces";
import { Keys } from "@/config/constants/browser.constants";
import { SendWithKeys, type SendWithKey } from "@/features/users/interfaces/users.interfaces";
import { SkillTabs } from "@/features/skills/interfaces/skills.interfaces";

interface Attachment {
  key: string;
  file: File;
  progress: number;
  stored?: StoredFile;
  error?: string;
}

interface Props {
  conversation: Conversation;
  sendWith: SendWithKey;
  working: boolean;
  disabled?: boolean;
  onSend: (dto: { content: string; file_ids?: string[]; send_anyway?: boolean; reply_to_message_id?: string }) => void;
  /** Message the user is replying to (swipe or menu); shown above the input and sent with the next message. */
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  meId: string;
  onStop: () => void;
  prefill?: string | null;
  onPrefillUsed?: () => void;
  /** Starts voice mode with a bot (§7.6). */
  onVoice?: (botId?: string) => void;
}

const PickerKinds = { MENTION: "mention", SKILL: "skill" } as const;
const MENTION_TRIGGER = "@";
type Picker = { kind: (typeof PickerKinds)[keyof typeof PickerKinds]; query: string; start: number } | null;

/** Floating composer (DESIGN.MD): attach, text (grows to 8 lines), @ bot picker, / skill picker, send ↔ stop. */
export const Composer: FC<Props> = ({ conversation, sendWith, working, disabled, onSend, onStop, prefill, onPrefillUsed, onVoice, replyingTo, onCancelReply, meId }) => {
  const [text, setText] = useState("");
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [active, setActive] = useState(0);
  const [secretCheck, setSecretCheck] = useState<{ secret: string; service: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: skills } = useSkills(SkillTabs.ALL);

  useEffect(() => {
    if (prefill) {
      setText(prefill);
      onPrefillUsed?.();
      requestAnimationFrame(() => ref.current?.focus());
    }
  }, [prefill, onPrefillUsed]);

  useEffect(() => {
    if (replyingTo) requestAnimationFrame(() => ref.current?.focus());
  }, [replyingTo]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24 + 16)}px`;
  }, [text]);

  type PickerOption = { id: string; insert: string; label: string; sub: string; bot?: { emoji: string; color: string }; user?: { name: string | null; email: string } };
  const options = useMemo<PickerOption[]>(() => {
    if (!picker) return [];
    const q = picker.query.toLowerCase();
    if (picker.kind === PickerKinds.MENTION) {
      return [
        ...conversation.bots.map((b) => ({ id: b.id, insert: `@${b.name} `, label: b.name, sub: "bot", bot: b })),
        ...conversation.users.map((u) => ({ id: u.id, insert: `@${u.name ?? u.email} `, label: u.name ?? u.email, sub: "person", user: u })),
      ].filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8);
    }
    return (skills ?? []).filter((s) => !s.deleted_at && (s.slug.includes(q) || s.name.toLowerCase().includes(q))).slice(0, 8).map((s) => ({ id: s.id, insert: `/${s.slug} `, label: s.emoji ? `${s.emoji} ${s.name}` : s.name, sub: s.description }));
  }, [picker, conversation, skills]);

  const detectPicker = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = /(^|\s)([@/])([\w-]{0,40})$/.exec(before);
    if (!m) return setPicker(null);
    if (m[2] === MENTION_TRIGGER && conversation.type === ConversationTypes.DIRECT && conversation.users.length <= 1) return setPicker(null);
    setPicker({ kind: m[2] === MENTION_TRIGGER ? PickerKinds.MENTION : PickerKinds.SKILL, query: m[3], start: caret - m[3].length - 1 });
    setActive(0);
  };

  const choose = (insert: string) => {
    if (!picker) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const next = text.slice(0, picker.start) + insert + text.slice(caret);
    setText(next);
    setPicker(null);
    requestAnimationFrame(() => {
      const pos = picker.start + insert.length;
      ref.current?.setSelectionRange(pos, pos);
      ref.current?.focus();
    });
  };

  const addFiles = useCallback(
    async (list: File[]) => {
      for (const file of list.slice(0, 10)) {
        const key = `${file.name}-${file.size}-${Math.random()}`;
        setFiles((f) => [...f, { key, file, progress: 0 }]);
        try {
          const stored = await uploadFile(file, "chat", { conversation_id: conversation.id, onProgress: (p) => setFiles((f) => f.map((a) => (a.key === key ? { ...a, progress: p } : a))) });
          setFiles((f) => f.map((a) => (a.key === key ? { ...a, stored, progress: 100 } : a)));
        } catch (e) {
          setFiles((f) => f.map((a) => (a.key === key ? { ...a, error: (e as Error).message } : a)));
          toast({ title: "Upload failed", description: (e as Error).message, variant: "error" });
        }
      }
    },
    [conversation.id],
  );

  const uploading = files.some((f) => !f.stored && !f.error);
  const ready = files.filter((f) => f.stored).map((f) => f.stored!.id);

  const doSend = (content: string, sendAnyway = false) => {
    if (!content.trim() && !ready.length) return;
    onSend({ content: content.trim() || ATTACHMENT_ONLY_CONTENT, file_ids: ready.length ? ready : undefined, send_anyway: sendAnyway || undefined, reply_to_message_id: replyingTo?.id });
    onCancelReply?.();
    setText("");
    setFiles([]);
    setPicker(null);
  };

  const submit = () => {
    if (disabled || uploading || (!text.trim() && !ready.length)) return;
    const secrets = findSecrets(text);
    if (secrets.length) {
      setSecretCheck({ secret: secrets[0].value, service: guessService(text, secrets[0].value) });
      return;
    }
    doSend(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker && options.length) {
      if (e.key === Keys.ARROW_DOWN) {
        e.preventDefault();
        setActive((a) => (a + 1) % options.length);
        return;
      }
      if (e.key === Keys.ARROW_UP) {
        e.preventDefault();
        setActive((a) => (a - 1 + options.length) % options.length);
        return;
      }
      if (e.key === Keys.ENTER || e.key === Keys.TAB) {
        e.preventDefault();
        choose(options[active].insert);
        return;
      }
      if (e.key === Keys.ESCAPE) {
        setPicker(null);
        return;
      }
    }
    if (e.key === Keys.ESCAPE && replyingTo) {
      onCancelReply?.();
      return;
    }
    if (e.key === Keys.ESCAPE && working) onStop();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === Keys.ENTER && !e.nativeEvent.isComposing && ((sendWith === SendWithKeys.ENTER && !e.shiftKey && !mod) || (sendWith === SendWithKeys.CTRL_ENTER && mod))) {
      e.preventDefault();
      submit();
    }
  };

  // Phones get a short, single-line hint (Grok-style "Ask …"); wider screens also explain @mentions and /skills.
  const target = conversation.type === ConversationTypes.GROUP ? conversation.name : (conversation.bots[0]?.name ?? "");
  const placeholder = replyingTo
    ? "Write your reply…"
    : isMobile
      ? `${conversation.type === ConversationTypes.GROUP ? "Message" : "Ask"} ${target}`
      : conversation.type === ConversationTypes.GROUP
        ? `Message ${target} — @mention a bot, / for skills`
        : `Message ${target}… (/ for skills)`;

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {picker && options.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-hairline bg-popover p-1.5 shadow-pop" role="listbox" aria-label={picker.kind === PickerKinds.MENTION ? "Mention" : "Skills"}>
          <p className="eyebrow px-2 py-1">{picker.kind === PickerKinds.MENTION ? "Mention" : "Skills"}</p>
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.insert);
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left", i === active ? "bg-primary-soft" : "hover:bg-surface-sunken")}
            >
              {o.bot ? <BotAvatar emoji={o.bot.emoji} color={o.bot.color} size={24} /> : o.user ? <PersonAvatar name={o.user.name} email={o.user.email} size={24} /> : null}
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink">{o.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={cn("rounded-xl border-[1.5px] border-hairline-strong bg-surface p-2 pl-3 shadow-pop transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--sh-pop),0_0_0_4px_rgba(107,78,255,0.22)]", dragOver && "border-primary")}>
        {replyingTo && (
          <div className="mb-2 pr-1 pt-0.5">
            <ReplyQuote reply={replyPreviewOf(replyingTo)!} meId={meId} variant={ReplyQuoteVariants.COMPOSER} onCancel={onCancelReply} />
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1 pt-1">
            {files.map((a) => (
              <span key={a.key} className={cn("inline-flex max-w-[240px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", a.error ? "border-error bg-error-soft" : "border-hairline bg-surface-soft")}>
                {!a.stored && !a.error && <Loader2 className="h-3 w-3 animate-spin" />}
                <span className="truncate font-semibold">{a.file.name}</span>
                <span className="text-muted-foreground">{a.stored ? formatBytes(a.file.size) : a.error ? "failed" : `${a.progress}%`}</span>
                <button type="button" aria-label={`Remove ${a.file.name}`} onClick={() => setFiles((f) => f.filter((x) => x.key !== a.key))} className="rounded-full p-0.5 hover:bg-surface-sunken">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Attach files" onClick={async () => addFiles(await platform.files.pick({ multiple: true }))} disabled={disabled}>
            <Paperclip className="!h-5 !w-5" />
          </Button>
          <textarea
            ref={ref}
            value={text}
            disabled={disabled}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              detectPicker(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files);
              if (pasted.length) {
                e.preventDefault();
                void addFiles(pasted);
              }
            }}
            placeholder={placeholder}
            aria-label="Message"
            className="scrollbar-thin max-h-[208px] min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-6 text-ink outline-none placeholder:text-muted-soft placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap md:text-[15px]"
          />
          {onVoice && !disabled && !text.trim() && !files.length && (
            conversation.bots.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Voice mode">
                    <AudioLines className="!h-5 !w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-md p-1.5">
                  <DropdownMenuLabel className="eyebrow px-2">Talk to</DropdownMenuLabel>
                  {conversation.bots.map((b) => (
                    <DropdownMenuItem key={b.id} onSelect={() => onVoice(b.id)} className="gap-2 rounded-sm py-2">
                      <BotAvatar emoji={b.emoji} color={b.color} size={24} /> {b.name}
                      {conversation.lead_bot?.id === b.id && <span className="ml-auto text-xs text-muted-foreground">Lead</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => onVoice(conversation.bots[0]?.id)} aria-label="Voice mode" title="Voice mode">
                <AudioLines className="!h-5 !w-5" />
              </Button>
            )
          )}
          {working ? (
            <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={onStop} aria-label="Stop the bot">
              <Square className="!h-4 !w-4 fill-current" />
            </Button>
          ) : (
            <Button type="button" size="icon" className="h-10 w-10 shrink-0" onClick={submit} disabled={disabled || uploading || (!text.trim() && !ready.length)} aria-label="Send">
              <ArrowUp className="!h-5 !w-5" strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </div>

      <StoreSecretDialog
        open={!!secretCheck}
        secret={secretCheck?.secret ?? ""}
        service={secretCheck?.service ?? ""}
        botIds={conversation.bots.map((b) => b.id)}
        onCancel={() => setSecretCheck(null)}
        onSendAnyway={() => {
          setSecretCheck(null);
          doSend(text, true);
        }}
        onStored={(label, hint) => {
          const remaining = stripSecrets(text, findSecrets(text)).trim();
          setSecretCheck(null);
          doSend(`${remaining}\n\n(I stored the key securely as "${label}" ${hint})`.trim());
        }}
      />
    </div>
  );
};
