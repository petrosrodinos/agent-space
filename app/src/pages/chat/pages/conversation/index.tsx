import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Pin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Markdown } from "@/components/ui/markdown";
import {
  useConversation, useConversationSearch, useDeleteConversation, useDeleteMessage, useEditMessage, useMarkRead, useMessages, usePinned, useReact, useRetryMessage, useSendMessage,
  useStopRun, useTogglePin, useUpdateMyConversation,
} from "@/features/conversations/hooks/use-conversations";
import { useConversationStream, type RunStatusMap } from "@/features/realtime/hooks/use-realtime";
import { allMessages, runStatusKey } from "@/features/conversations/utils/messages-cache";
import type { Message } from "@/features/conversations/interfaces/conversations.interfaces";
import { useMe } from "@/features/users/hooks/use-users";
import { useModels, useBot } from "@/features/bots/hooks/use-bots";
import { useMediaQuery } from "@/hooks/use-media-query";
import { toast } from "@/hooks/use-toast";
import { dayLabel, formatDateTime } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { Composer } from "../../components/composer";
import { VoiceBar } from "../../components/voice-bar";
import { useVoiceSession } from "@/features/voice/hooks/use-voice-session";
import { MessageItem, type MessageActions } from "../../components/message-item";
import { ConversationHeader } from "../../components/conversation-header";
import { ConversationInfoPanel } from "../../components/conversation-info-panel";
import { BotPanel } from "../../components/bot-panel";
import { ConversationMenu } from "../../components/conversation-menu";
import { MobileTopBar, useBack } from "@/components/layout/mobile-top-bar";
import { ResizableAside } from "@/components/ui/resizable-aside";
import { CONVERSATION_PANEL_WIDTH, useUiStore } from "@/stores/ui";
import { QueryKeys } from "@/config/constants/query-keys";
import { ConversationTypes, ConversationViews, MessageAuthorTypes, MessageStatuses, MessagePartTypes, SecretInputStatuses, ComputerHandoffStatuses } from "@/features/conversations/interfaces/conversations.interfaces";
import { ApprovalStatuses, ACTIVE_RUN_STATUSES } from "@/features/tasks/interfaces/tasks.interfaces";
import { ActivityStepsDisplays, SendWithKeys } from "@/features/users/interfaces/users.interfaces";

const ACTIVE: string[] = ACTIVE_RUN_STATUSES;
const FLASH_CLASSES = ["bg-primary-soft", "rounded-lg", "transition-colors", "duration-500"];
const FLASH_MS = 1400;

/** A bot message counts as "working" while streaming — but not while it waits on the user (approval or secret box). */
function isWorking(m: Message, runStatus: RunStatusMap | undefined) {
  if (!m.author_bot || (m.status !== MessageStatuses.STREAMING && m.status !== MessageStatuses.PENDING)) return false;
  const live = runStatus?.[m.author_bot.id];
  if (live && live.run_id === m.run_id && !ACTIVE.includes(live.status)) return false;
  if (m.run && !ACTIVE.includes(m.run.status)) return false;
  return !m.parts.some((p) => (p.type === MessagePartTypes.APPROVAL && p.status === ApprovalStatuses.PENDING) || (p.type === MessagePartTypes.SECRET_INPUT && p.status === SecretInputStatuses.PENDING) || (p.type === MessagePartTypes.COMPUTER_HANDOFF && p.status === ComputerHandoffStatuses.WAITING));
}

const MessagesSkeleton: FC = () => (
  <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 pb-6 pt-20">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className={i % 2 ? "flex justify-end" : "flex gap-3"}>
        {i % 2 === 0 && <Skeleton className="h-10 w-10 rounded-md" />}
        <Skeleton className={i % 2 ? "h-12 w-2/5 rounded-lg" : "h-20 w-3/5 rounded-lg"} />
      </div>
    ))}
  </div>
);

const ConversationPage: FC = () => {
  const { conversationId = "", view } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: conversation, isPending: convPending, error: convError } = useConversation(conversationId);
  const messagesQuery = useMessages(conversationId);
  const { data: models } = useModels();
  useConversationStream(conversationId);
  const { data: runStatus } = useQuery<RunStatusMap>({ queryKey: runStatusKey(conversationId), queryFn: () => ({}), staleTime: Infinity, enabled: !!conversationId });

  const send = useSendMessage(conversationId);
  const voice = useVoiceSession(conversationId);
  const stop = useStopRun();
  const retry = useRetryMessage();
  const react = useReact();
  const pin = useTogglePin();
  const edit = useEditMessage();
  const del = useDeleteMessage(conversationId);
  const markRead = useMarkRead();
  const updateMine = useUpdateMyConversation();
  const deleteConv = useDeleteConversation();

  const isDesktop = useMediaQuery("(min-width: 1200px)");
  const isPhone = !useMediaQuery("(min-width: 768px)");
  // Phones: the panel is its own page (/c/:id/details) over the chat, with a back button. The chat stays mounted underneath
  // so going back keeps its scroll position.
  const detailsPage = view === ConversationViews.DETAILS;
  const back = useBack(Routes.chat.conversation(conversationId));
  // Wider screens have no details page: fall back to the chat with the panel open.
  useEffect(() => {
    if (detailsPage && !isPhone) {
      navigate(Routes.chat.conversation(conversationId), { replace: true });
      if (isDesktop) useUiStore.getState().setConversationPanelOpen(true);
    }
  }, [detailsPage, isPhone, isDesktop, conversationId, navigate]);
  // Desktop: the panel sits beside the chat and is remembered across chats. Tablets: a sheet that starts closed.
  const desktopPanel = useUiStore((s) => s.conversation_panel_open);
  const setDesktopPanel = useUiStore((s) => s.setConversationPanelOpen);
  const panelWidth = useUiStore((s) => s.conversation_panel_width);
  const setPanelWidth = useUiStore((s) => s.setConversationPanelWidth);
  const [sheetPanel, setSheetPanel] = useState(false);
  const panel = isDesktop ? desktopPanel : sheetPanel;
  const setPanel = useCallback((v: boolean) => (isDesktop ? setDesktopPanel(v) : setSheetPanel(v)), [isDesktop, setDesktopPanel]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);
  const [query, setQuery] = useState("");
  const [prefill, setPrefill] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const searchResults = useConversationSearch(conversationId, searchOpen ? query : "");
  const pinned = usePinned(conversationId, pinnedOpen);

  const messages = useMemo(() => allMessages(messagesQuery.data), [messagesQuery.data]);
  const replyingTo = useMemo(() => (replyingToId ? (messages.find((m) => m.id === replyingToId) ?? null) : null), [replyingToId, messages]);
  const leadBotId = conversation?.bots[0]?.id ?? "";
  const { data: leadBot } = useBot(conversation?.type === ConversationTypes.DIRECT ? leadBotId : "");

  // Who is working: live run status, plus any bot message still streaming.
  const working = useMemo(() => {
    const ids = new Set<string>();
    Object.entries(runStatus ?? {}).forEach(([bot, s]) => ACTIVE.includes(s.status) && ids.add(bot));
    messages.forEach((m) => isWorking(m, runStatus) && ids.add(m.author_bot!.id));
    return [...ids];
  }, [runStatus, messages]);
  const activeRunIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(runStatus ?? {}).forEach((s) => ACTIVE.includes(s.status) && ids.add(s.run_id));
    messages.forEach((m) => isWorking(m, runStatus) && m.run_id && ids.add(m.run_id));
    return [...ids];
  }, [runStatus, messages]);

  // ---- Scrolling: stick to the bottom while the user is there; keep position when older messages load ----
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const prevHeight = useRef(0);
  const loadingOlder = useRef(false);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (loadingOlder.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current + el.scrollTop;
      loadingOlder.current = false;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    atBottom.current = true;
    setReplyingToId(null);
    requestAnimationFrame(() => scrollToBottom());
  }, [conversationId, scrollToBottom]);

  /** Scrolls to a quoted message and flashes it; pages in older history first when it isn't loaded yet. */
  const messagesQueryRef = useRef(messagesQuery);
  messagesQueryRef.current = messagesQuery;
  const jumpToMessage = useCallback(
    async (id: string) => {
      const find = () => document.getElementById(`msg-${id}`);
      let el = find();
      let hasMore = messagesQueryRef.current.hasNextPage;
      while (!el && hasMore && scroller.current) {
        loadingOlder.current = true;
        prevHeight.current = scroller.current.scrollHeight;
        const res = await messagesQueryRef.current.fetchNextPage();
        hasMore = res.hasNextPage;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        el = find();
      }
      if (!el) {
        toast({ title: "Original message not found", description: "It may have been deleted." });
        return;
      }
      const target = el;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add(...FLASH_CLASSES);
      window.setTimeout(() => target.classList.remove(...FLASH_CLASSES), FLASH_MS);
    },
    [],
  );

  useEffect(() => {
    if (conversationId && conversation && (conversation.me?.unread_count ?? 0) >= 0) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = dist < 80;
    setShowJump(dist > 400);
    if (el.scrollTop < 200 && messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      loadingOlder.current = true;
      prevHeight.current = el.scrollHeight;
      void messagesQuery.fetchNextPage();
    }
  };

  const { sessionId: voiceSessionId, sendText: sendVoiceText } = voice;
  const actions: MessageActions = useMemo(
    () => ({
      onRetry: (m, modelId) => retry.mutate({ id: m.id, model_id: modelId }),
      onBranch: (m) => retry.mutate({ id: m.id, branch: true }),
      onReact: (m, emoji) => react.mutate({ id: m.id, emoji }),
      onPin: (m) => pin.mutate(m.id),
      onEdit: (m, content) => edit.mutate({ id: m.id, content, rerun: true }),
      onDelete: (m) => setDeletingMsg(m),
      onFollowUp: (text) => {
        atBottom.current = true;
        // In voice mode the bot answers out loud in the same session, like typing with the Keyboard button.
        if (voiceSessionId) void sendVoiceText(text);
        else send.mutate({ content: text });
      },
      onReply: (m) => setReplyingToId(m.id),
      onJumpToMessage: (id) => void jumpToMessage(id),
    }),
    [retry, react, pin, edit, send, jumpToMessage, voiceSessionId, sendVoiceText],
  );

  if (convError) {
    return (
      <EmptyState
        title="Conversation not found"
        description="It may have been deleted, or you're no longer in it."
        action={<Button onClick={() => navigate(Routes.chat.root)}>Back to chats</Button>}
        stickers={[{ icon: Search, color: "#38B6FF" }]}
      />
    );
  }

  // New chats carry the bot's welcome as a real first message; the header only repeats it for older, empty chats.
  const welcome = messages.length === 0 ? leadBot?.welcome_message : null;
  const userHasWritten = messages.some((m) => m.author_type === MessageAuthorTypes.USER);
  const starters = conversation?.type === ConversationTypes.DIRECT ? (leadBot?.conversation_starters ?? []) : [];
  const activityMode = me?.settings.activity_steps_display ?? ActivityStepsDisplays.COLLAPSED;

  const menu = conversation && (
    <ConversationMenu
      conversation={conversation}
      onPinned={() => setPinnedOpen(true)}
      onFavourite={() => updateMine.mutate({ id: conversation.id, is_favourite: !conversation.me?.is_favourite })}
      onArchive={() => updateMine.mutate({ id: conversation.id, is_archived: !conversation.me?.is_archived }, { onSuccess: () => navigate(Routes.chat.root) })}
      onDelete={() => setConfirmDelete(true)}
    />
  );
  const panelContent =
    conversation &&
    (conversation.type === ConversationTypes.DIRECT && leadBotId ? (
      <BotPanel botId={leadBotId} working={working.includes(leadBotId)} onClose={() => setPanel(false)} menu={menu} />
    ) : (
      <ConversationInfoPanel conversation={conversation} meId={me?.user.id ?? ""} onClose={() => setPanel(false)} menu={menu} />
    ));

  return (
    <div className="relative flex h-full min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {conversation ? (
          <ConversationHeader
            conversation={conversation}
            working={working}
            panelOpen={isPhone ? detailsPage : panel}
            onInfo={() => (isPhone ? navigate(Routes.chat.details(conversationId)) : setPanel(!panel))}
            onSearch={() => setSearchOpen(true)}
          />
        ) : (
          <div className="absolute inset-x-0 top-0 z-30 flex h-[68px] items-center gap-3 px-3 md:justify-center">
            <Skeleton className="h-11 w-48 rounded-full" />
          </div>
        )}

        <div ref={scroller} onScroll={onScroll} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden" role="log" aria-live="polite" aria-label="Messages">
          {messagesQuery.isPending || convPending ? (
            <MessagesSkeleton />
          ) : (
            <div className="mx-auto w-full max-w-[760px] px-3 pb-6 pt-[calc(72px+env(safe-area-inset-top))] sm:px-4 md:pt-[72px]">
              {messagesQuery.isFetchingNextPage && <Skeleton className="mx-auto mb-4 h-6 w-32 rounded-full" />}
              {!messagesQuery.hasNextPage && conversation && (
                <div className="mb-6 flex flex-col items-center pt-6 text-center">
                  {conversation.type === ConversationTypes.DIRECT && conversation.bots[0] ? (
                    <BotAvatar emoji={conversation.bots[0].emoji} color={conversation.bots[0].color} size={88} followCursor />
                  ) : (
                    <span className="inline-flex h-[88px] w-[88px] items-center justify-center rounded-xl text-5xl" style={{ backgroundColor: conversation.color }}>
                      {conversation.emoji}
                    </span>
                  )}
                  <h2 className="mt-3 font-display text-2xl font-bold text-ink">{conversation.name}</h2>
                  {welcome ? <Markdown className="mt-2 max-w-md text-muted-foreground">{welcome}</Markdown> : <p className="mt-1 max-w-md text-sm text-muted-foreground">{conversation.type === ConversationTypes.DIRECT ? conversation.bots[0]?.description : "Talk to a specific bot with @name, or just ask — the lead bot coordinates."}</p>}
                </div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const sameAuthor = prev && !newDay && prev.author_type === m.author_type && (prev.author_bot?.id ?? prev.author_user?.id) === (m.author_bot?.id ?? m.author_user?.id) && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
                return (
                  <div key={m.id} id={`msg-${m.id}`} style={{ contentVisibility: i < messages.length - 15 ? "auto" : undefined, containIntrinsicSize: "auto 120px" }}>
                    {newDay && (
                      <div className="my-5 flex items-center gap-3" role="separator">
                        <span className="h-px flex-1 bg-hairline" />
                        <span className="text-xs font-bold text-muted-foreground">{dayLabel(m.created_at)}</span>
                        <span className="h-px flex-1 bg-hairline" />
                      </div>
                    )}
                    <MessageItem
                      message={m}
                      meId={me?.user.id ?? ""}
                      isFirstOfGroup={!sameAuthor}
                      working={!!m.author_bot && working.includes(m.author_bot.id)}
                      activityMode={activityMode}
                      models={models ?? []}
                      actions={actions}
                      canAnswerApprovals
                    />
                  </div>
                );
              })}
              {!messagesQuery.hasNextPage && !userHasWritten && starters.length > 0 && (
                <div className="mx-auto mt-4 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {starters.map((s) => (
                    <button key={s} type="button" onClick={() => send.mutate({ content: s })} className="card-lift min-h-[48px] rounded-lg border border-hairline bg-surface px-4 py-3 text-left text-sm font-semibold text-body shadow-sticker">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4">
          {showJump && (
            <Button variant="outline" size="icon" className="absolute -top-12 left-1/2 h-10 w-10 -translate-x-1/2 shadow-pop" onClick={() => scrollToBottom(true)} aria-label="Jump to latest">
              <ArrowDown />
            </Button>
          )}
          <div className="mx-auto w-full max-w-[760px]">
            {conversation && voice.active && <VoiceBar voice={voice} bot={conversation.bots.find((b) => b.id === voice.botId) ?? conversation.lead_bot ?? conversation.bots[0] ?? null} />}
            {conversation && !voice.active && (
              <Composer
                conversation={conversation}
                sendWith={me?.settings.send_with ?? SendWithKeys.ENTER}
                working={working.length > 0}
                meId={me?.user.id ?? ""}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingToId(null)}
                prefill={prefill}
                onPrefillUsed={() => setPrefill(null)}
                onSend={(dto) => {
                  atBottom.current = true;
                  send.mutate(dto);
                }}
                onStop={() => activeRunIds.forEach((id) => stop.mutate(id))}
                onVoice={(botId) => void voice.start({ botId, inputMode: me?.settings.voice_input_mode })}
              />
            )}
          </div>
        </div>
      </div>

      {/* Side panel: pushes the chat on desktop, overlays as a sheet below 1200px (DESIGN.MD). */}
      {conversation && isDesktop && (
        <ResizableAside open={panel} width={panelWidth} min={CONVERSATION_PANEL_WIDTH.MIN} max={CONVERSATION_PANEL_WIDTH.MAX} onWidthChange={setPanelWidth} className="bg-canvas" handleLabel="Resize side panel">
          {panelContent}
        </ResizableAside>
      )}
      {conversation && isPhone && detailsPage && (
        <div className="absolute inset-0 z-40 flex flex-col bg-canvas duration-300 animate-in fade-in slide-in-from-right-8">
          <MobileTopBar
            className="static"
            onBack={back}
            actions={menu}
          />
          <div className="min-h-0 flex-1">
            {conversation.type === ConversationTypes.DIRECT && leadBotId ? (
              <BotPanel botId={leadBotId} working={working.includes(leadBotId)} />
            ) : (
              <ConversationInfoPanel conversation={conversation} meId={me?.user.id ?? ""} />
            )}
          </div>
        </div>
      )}
      {conversation && !isDesktop && !isPhone && (
        <Sheet open={panel} onOpenChange={setPanel}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-[420px] [&>button:last-child]:hidden">
            <SheetTitle className="sr-only">Conversation details</SheetTitle>
            <SheetDescription className="sr-only">People, bots and settings for this conversation</SheetDescription>
            {panelContent}
          </SheetContent>
        </Sheet>
      )}

      <Dialog open={searchOpen} onOpenChange={setSearchOpen} closeOnOutsideClick>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search this conversation</DialogTitle>
            <DialogDescription className="sr-only">Find messages</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages" className="pl-9" />
          </div>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {(searchResults.data?.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                className="w-full rounded-md p-2 text-left hover:bg-surface-sunken"
                onClick={() => {
                  setSearchOpen(false);
                  document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <span className="block text-xs font-semibold text-muted-foreground">
                  {m.author_bot?.name ?? m.author_user?.name} · {formatDateTime(m.created_at)}
                </span>
                <span className="line-clamp-2 text-sm text-ink">{m.content}</span>
              </button>
            ))}
            {query.length > 1 && searchResults.data?.data.length === 0 && <p className="p-2 text-sm text-muted-foreground">No messages match.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pinnedOpen} onOpenChange={setPinnedOpen} closeOnOutsideClick>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pin className="h-5 w-5" /> Pinned</DialogTitle>
            <DialogDescription className="sr-only">Pinned messages</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {pinned.isPending ? (
              <Skeleton className="h-16 w-full rounded-md" />
            ) : pinned.data?.length ? (
              pinned.data.map((m) => (
                <div key={m.id} className="rounded-md border border-hairline bg-surface p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {m.author_bot?.name ?? m.author_user?.name} · {formatDateTime(m.created_at)}
                  </p>
                  <p className="line-clamp-4 text-sm text-ink">{m.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nothing pinned yet. Use a message's menu to pin it.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this conversation?"
        description="Its messages and files are removed (restorable for 30 days). In shared conversations you'll leave instead."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteConv.isPending}
        onConfirm={() =>
          deleteConv.mutate(conversationId, {
            onSuccess: () => {
              setConfirmDelete(false);
              qc.removeQueries({ queryKey: [QueryKeys.MESSAGES, conversationId] });
              navigate(Routes.chat.root);
            },
          })
        }
      />
      <ConfirmationDialog
        isOpen={!!deletingMsg}
        onClose={() => setDeletingMsg(null)}
        title="Delete this message?"
        description="It will be removed for everyone in the conversation."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => deletingMsg && del.mutate(deletingMsg.id, { onSuccess: () => setDeletingMsg(null) })}
      />
    </div>
  );
};

export default ConversationPage;
