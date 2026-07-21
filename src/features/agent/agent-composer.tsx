"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Ellipsis,
  History,
  Loader2,
  Pin,
  Search,
  SquarePen,
  X,
} from "@/components/icons";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AppUser } from "@/domain";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentComposerInput } from "@/features/agent/agent-composer-input";
import { useAgentContext } from "@/features/agent/agent-context";
import {
  createEmptyConversation,
  getActiveConversation,
  loadConversationStore,
  messageText,
  messagesEqual,
  saveConversationStore,
  titleFromMessages,
  upsertConversation,
  type AgentConversation,
} from "@/features/agent/agent-conversations";
import {
  AgentEmptySuggestions,
  getAgentSuggestions,
} from "@/features/agent/agent-empty-suggestions";
import { AgentModelSelect } from "@/features/agent/agent-model-select";
import {
  loadPreferredChatModel,
  savePreferredChatModel,
} from "@/features/agent/agent-model-preference";
import { CreativeCardFromId } from "@/features/creatives/creative-card-from-id";
import { InsightCardFromId } from "@/features/insights/insight-card-from-id";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  isPaidPlan,
  normalizeWorkspacePlan,
} from "@/lib/billing/entitlements";
import {
  openVisualizationTab,
  upsertVisualization,
} from "@/features/visualizer/visualization-store";
import type { Visualization } from "@/domain";
import { useWalletOptional } from "@/features/wallet/wallet-context";
import { userFacingErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const AgentMessageMarkdown = dynamic(
  () =>
    import("@/features/agent/agent-message-markdown").then(
      (m) => m.AgentMessageMarkdown,
    ),
  {
    ssr: false,
    loading: () => (
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        …
      </span>
    ),
  },
);

function extractCreateVisualizationResults(messages: UIMessage[]): Array<{
  toolCallId: string;
  visualization: Visualization;
  href: string;
}> {
  const found: Array<{
    toolCallId: string;
    visualization: Visualization;
    href: string;
  }> = [];

  for (const message of messages) {
    if (message.role !== "assistant" || !Array.isArray(message.parts)) continue;
    for (const part of message.parts) {
      const p = part as {
        type?: string;
        toolName?: string;
        toolCallId?: string;
        state?: string;
        output?: {
          ok?: boolean;
          href?: string;
          visualization?: Visualization;
        };
      };
      const isCreateViz =
        p.type === "tool-create_visualization" ||
        (p.type === "dynamic-tool" && p.toolName === "create_visualization");
      if (!isCreateViz || p.state !== "output-available" || !p.toolCallId) {
        continue;
      }
      if (
        p.output?.ok &&
        p.output.visualization &&
        typeof p.output.href === "string"
      ) {
        found.push({
          toolCallId: p.toolCallId,
          visualization: p.output.visualization,
          href: p.output.href,
        });
      }
    }
  }
  return found;
}

function extractCreativeIdsFromMessage(message: UIMessage): string[] {
  if (message.role !== "assistant" || !Array.isArray(message.parts)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const part of message.parts) {
    const p = part as {
      type?: string;
      toolName?: string;
      state?: string;
      output?: { ok?: boolean; creativeId?: string };
    };
    const isCreativeTool =
      p.type === "tool-create_video_creative" ||
      p.type === "tool-resubmit_creative" ||
      (p.type === "dynamic-tool" &&
        (p.toolName === "create_video_creative" ||
          p.toolName === "resubmit_creative"));
    if (!isCreativeTool || p.state !== "output-available") continue;
    const id = p.output?.ok ? p.output.creativeId : undefined;
    if (typeof id === "string" && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function extractInsightIdsFromMessage(message: UIMessage): string[] {
  if (message.role !== "assistant" || !Array.isArray(message.parts)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const part of message.parts) {
    const p = part as {
      type?: string;
      toolName?: string;
      state?: string;
      output?: { ok?: boolean; insightId?: string };
    };
    const isInsightTool =
      p.type === "tool-propose_insight" ||
      p.type === "tool-resubmit_insight" ||
      (p.type === "dynamic-tool" &&
        (p.toolName === "propose_insight" ||
          p.toolName === "resubmit_insight"));
    if (!isInsightTool || p.state !== "output-available") continue;
    const id = p.output?.ok ? p.output.insightId : undefined;
    if (typeof id === "string" && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function extractCreativeToolErrors(message: UIMessage): string[] {
  if (message.role !== "assistant" || !Array.isArray(message.parts)) return [];
  const errors: string[] = [];

  for (const part of message.parts) {
    const p = part as {
      type?: string;
      toolName?: string;
      state?: string;
      output?: { ok?: boolean; error?: string; message?: string };
    };
    const isCreativeTool =
      p.type === "tool-create_video_creative" ||
      p.type === "tool-resubmit_creative" ||
      (p.type === "dynamic-tool" &&
        (p.toolName === "create_video_creative" ||
          p.toolName === "resubmit_creative"));
    if (!isCreativeTool || p.state !== "output-available") continue;
    if (p.output?.ok === false) {
      const msg = p.output.error ?? p.output.message;
      if (typeof msg === "string" && msg.trim()) errors.push(msg);
    }
  }
  return errors;
}

function formatCreativeToolError(err: string, plan: string | undefined): string {
  const looksLikePlanGate =
    /upgrade to continue/i.test(err) || /creatives require/i.test(err);
  const normalized = normalizeWorkspacePlan(plan);
  if (looksLikePlanGate && isPaidPlan(normalized)) {
    return `${err} Your workspace is on ${normalized === "pro" ? "Pro" : "Growth"} now — start a new chat and ask again so the agent retries.`;
  }
  return err;
}

const menuItemClass =
  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

const MESSAGE_PAGE_SIZE = 40;

function HistoryConversationRow({
  conversation,
  isActive,
  busy,
  onSelect,
  onTogglePin,
  onRename,
  onDelete,
}: {
  conversation: AgentConversation;
  isActive: boolean;
  busy: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renaming]);

  function commitRename() {
    const next = draftTitle.trim();
    if (next && next !== conversation.title) {
      onRename(next);
    } else {
      setDraftTitle(conversation.title);
    }
    setRenaming(false);
  }

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <input
          ref={renameRef}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setDraftTitle(conversation.title);
              setRenaming(false);
            }
          }}
          className="h-9 w-full rounded-lg bg-transparent px-2 text-sm outline-none ring-1 ring-ring/50"
          aria-label="Rename conversation"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg transition-colors",
        isActive ? "bg-muted text-foreground" : "hover:bg-muted/60",
        busy && "opacity-50",
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onSelect}
        className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
      >
        {conversation.title}
      </button>

      <div
        className={cn(
          "absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-inherit pl-2 transition-opacity",
          menuOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={busy}
          title={conversation.pinned ? "Unpin conversation" : "Pin conversation"}
          aria-label={
            conversation.pinned ? "Unpin conversation" : "Pin conversation"
          }
          aria-pressed={Boolean(conversation.pinned)}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          <Pin
            className={cn(
              "size-3.5",
              conversation.pinned && "fill-current",
            )}
          />
        </Button>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={busy}
                title="Conversation actions"
                aria-label="Conversation actions"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <Ellipsis className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="min-w-36 p-1">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setMenuOpen(false);
                setDraftTitle(conversation.title);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className={cn(menuItemClass, "text-destructive")}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function LoadOlderSentinel({
  hasOlder,
  loading,
  onLoadOlder,
}: {
  hasOlder: boolean;
  loading: boolean;
  onLoadOlder: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadOlder();
        }
      },
      { root: node.closest("[data-slot=message-scroller-viewport]"), rootMargin: "120px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasOlder, onLoadOlder]);

  if (!hasOlder && !loading) return null;

  return (
    <div
      ref={sentinelRef}
      className="flex h-4 items-center justify-center"
      aria-hidden
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

export function AgentComposer({
  user,
  workspaceId,
}: {
  user: AppUser;
  workspaceId?: string | null;
}) {
  const router = useRouter();
  const { route } = useAgentContext();
  const walletCtx = useWalletOptional();
  const productId = route.mode === "product" ? route.productId : undefined;
  const productTitle =
    route.mode === "product" ? route.productTitle : undefined;
  const isWorkspace = !productId;

  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeId, setActiveId] = useState(() => createEmptyConversation().id);
  const [seedMessages, setSeedMessages] = useState<UIMessage[]>([]);
  const [visibleCount, setVisibleCount] = useState(MESSAGE_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
  const historySearchRef = useRef<HTMLInputElement>(null);
  const handledVizToolCallIds = useRef(new Set<string>());
  const chatModelRef = useRef(chatModel);

  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title?.trim() || "New chat";

  const messagesRef = useRef<UIMessage[]>([]);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    chatModelRef.current = chatModel;
  }, [chatModel]);

  useEffect(() => {
    // Hydrate preferred model from localStorage for this user session.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate-model-pref
    setChatModel(loadPreferredChatModel(user.id));
  }, [user.id]);

  const handleChatModelChange = useCallback(
    (modelId: string) => {
      setChatModel(modelId);
      savePreferredChatModel(user.id, modelId);
    },
    [user.id],
  );

  useEffect(() => {
    // Hydrate chat history from localStorage for this user session.
    const store = loadConversationStore(user.id);
    const active = getActiveConversation(store);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate-from-storage
    setConversations(store.conversations);
    setActiveId(active.id);
    setSeedMessages(active.messages);
    setVisibleCount(MESSAGE_PAGE_SIZE);
    setHydrated(true);
  }, [user.id]);

  useEffect(() => {
    if (!historyOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (historySearchOpen) {
        setHistorySearchOpen(false);
        setHistoryQuery("");
        return;
      }
      setHistoryOpen(false);
      setHistorySearchOpen(false);
      setHistoryQuery("");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen, historySearchOpen]);

  useEffect(() => {
    if (!historySearchOpen) return;
    historySearchRef.current?.focus();
  }, [historySearchOpen]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: {
            id,
            messages,
            model: chatModelRef.current,
            ...(productId ? { productId } : {}),
          },
        }),
      }),
    [productId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: activeId,
    messages: seedMessages,
    transport,
    onFinish: () => {
      router.refresh();
      void walletCtx?.refresh();
    },
    onError: (err) => {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      if (
        raw.includes("402") ||
        raw.includes("wallet_blocked") ||
        raw.includes("Wallet blocked")
      ) {
        walletCtx?.revealBlockedBanner();
        toast.error(
          "AI is blocked until you add credits or raise your usage limit.",
        );
        void walletCtx?.refresh();
        return;
      }
      toast.error(userFacingErrorMessage(err));
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const walletBlocked = walletCtx?.wallet?.blocked === true;
  const waitingForAssistant =
    busy &&
    (messages.length === 0 || messages[messages.length - 1]?.role === "user");

  const prevChatStatus = useRef(status);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const wasBusy =
      prevChatStatus.current === "submitted" ||
      prevChatStatus.current === "streaming";
    prevChatStatus.current = status;
    if (!workspaceId || !wasBusy || status !== "ready") return;

    const results = extractCreateVisualizationResults(messages);
    for (const result of results) {
      if (handledVizToolCallIds.current.has(result.toolCallId)) continue;
      handledVizToolCallIds.current.add(result.toolCallId);
      upsertVisualization(workspaceId, result.visualization);
      openVisualizationTab(workspaceId, result.visualization.id);
      window.dispatchEvent(new Event("visualizations-changed"));
      router.push(result.href);
    }
  }, [messages, router, status, workspaceId]);

  const hasOlderMessages = messages.length > visibleCount;
  const visibleMessages = hasOlderMessages
    ? messages.slice(messages.length - visibleCount)
    : messages;

  const loadOlderMessages = useCallback(() => {
    if (!hasOlderMessages || loadingOlder) return;
    setLoadingOlder(true);
    setVisibleCount((count) =>
      Math.min(count + MESSAGE_PAGE_SIZE, messages.length),
    );
    requestAnimationFrame(() => setLoadingOlder(false));
  }, [hasOlderMessages, loadingOlder, messages.length]);

  useEffect(() => {
    if (!hydrated || busy) return;

    const derivedTitle = titleFromMessages(messages);
    const now = new Date().toISOString();

    // Persist the active conversation whenever the chat stream updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync-chat-to-storage
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeId);
      const unchanged = messagesEqual(existing?.messages, messages);
      const nextConversation: AgentConversation = {
        id: activeId,
        title: existing?.titleCustom
          ? (existing.title ?? derivedTitle)
          : derivedTitle,
        messages,
        createdAt: existing?.createdAt ?? now,
        updatedAt: unchanged
          ? (existing?.updatedAt ?? now)
          : messages.length > 0
            ? now
            : (existing?.updatedAt ?? now),
        pinned: existing?.pinned === true,
        titleCustom: existing?.titleCustom === true,
      };
      const merged = upsertConversation(
        { activeId, conversations: prev },
        nextConversation,
      );
      const pruned = {
        ...merged,
        conversations: merged.conversations.filter(
          (c) => c.id === activeId || c.messages.length > 0,
        ),
      };
      saveConversationStore(user.id, pruned);
      return pruned.conversations;
    });
  }, [messages, activeId, hydrated, user.id, busy]);

  function persistCurrent() {
    const currentMessages = messagesRef.current;
    const id = activeIdRef.current;
    const derivedTitle = titleFromMessages(currentMessages);
    const now = new Date().toISOString();

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id);
      const unchanged = messagesEqual(existing?.messages, currentMessages);
      const nextConversation: AgentConversation = {
        id,
        title: existing?.titleCustom
          ? (existing.title ?? derivedTitle)
          : derivedTitle,
        messages: currentMessages,
        createdAt: existing?.createdAt ?? now,
        updatedAt: unchanged ? (existing?.updatedAt ?? now) : now,
        pinned: existing?.pinned === true,
        titleCustom: existing?.titleCustom === true,
      };
      const nextStore = upsertConversation(
        { activeId: id, conversations: prev },
        nextConversation,
      );
      saveConversationStore(user.id, nextStore);
      return nextStore.conversations;
    });
  }

  function startNewConversation() {
    if (busy) return;
    if (messagesRef.current.length === 0) return;

    persistCurrent();
    const empty = createEmptyConversation();
    setConversations((prev) => {
      const nextStore = upsertConversation(
        { activeId: empty.id, conversations: prev },
        empty,
      );
      saveConversationStore(user.id, nextStore);
      return nextStore.conversations;
    });
    setSeedMessages([]);
    setActiveId(empty.id);
    setVisibleCount(MESSAGE_PAGE_SIZE);
    setHistoryOpenSafe(false);
  }

  function selectConversation(conversation: AgentConversation) {
    if (busy) return;
    if (conversation.id === activeId) {
      setHistoryOpenSafe(false);
      return;
    }

    persistCurrent();
    setSeedMessages(conversation.messages);
    setActiveId(conversation.id);
    setVisibleCount(MESSAGE_PAGE_SIZE);
    setConversations((prev) => {
      const nextStore = {
        activeId: conversation.id,
        conversations: prev,
      };
      saveConversationStore(user.id, nextStore);
      return prev;
    });
    setHistoryOpenSafe(false);
  }

  function updateConversations(
    updater: (prev: AgentConversation[]) => AgentConversation[],
    nextActiveId = activeId,
  ) {
    setConversations((prev) => {
      const next = updater(prev);
      saveConversationStore(user.id, {
        activeId: nextActiveId,
        conversations: next,
      });
      return next;
    });
  }

  function togglePinConversation(conversationId: string) {
    updateConversations((prev) => {
      const next = prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, pinned: !conversation.pinned }
          : conversation,
      );
      return next.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1;
        }
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    });
  }

  function renameConversation(conversationId: string, title: string) {
    updateConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title, titleCustom: true }
          : conversation,
      ),
    );
  }

  function deleteConversation(conversationId: string) {
    if (busy) return;

    const remaining = conversations.filter((c) => c.id !== conversationId);

    if (conversationId !== activeId) {
      updateConversations(() => remaining);
      return;
    }

    const fallback =
      remaining.find((c) => c.messages.length > 0) ?? createEmptyConversation();
    const nextConversations = remaining.some((c) => c.id === fallback.id)
      ? remaining
      : [fallback, ...remaining];

    setSeedMessages(fallback.messages);
    setActiveId(fallback.id);
    setVisibleCount(MESSAGE_PAGE_SIZE);
    updateConversations(() => nextConversations, fallback.id);
  }

  async function handleSend({
    text,
    files,
  }: {
    text: string;
    files: File[];
  }) {
    if ((!text && files.length === 0) || busy) return;
    if (walletBlocked) {
      walletCtx?.revealBlockedBanner();
      toast.error(
        "AI is blocked until you add credits or raise your usage limit.",
      );
      return;
    }

    if (files.length > 0) {
      const dataTransfer = new DataTransfer();
      for (const file of files) dataTransfer.items.add(file);
      await sendMessage({ text: text || " ", files: dataTransfer.files });
      return;
    }

    await sendMessage({ text });
  }

  const handleSuggestionSelect = useCallback(
    (suggestion: { prompt: string }) => {
      if (busy || walletBlocked) {
        if (walletBlocked) {
          walletCtx?.revealBlockedBanner();
          toast.error(
            "AI is blocked until you add credits or raise your usage limit.",
          );
        }
        return;
      }
      void sendMessage({ text: suggestion.prompt });
    },
    [busy, sendMessage, walletBlocked, walletCtx],
  );

  function closeHistorySearch() {
    setHistorySearchOpen(false);
    setHistoryQuery("");
  }

  function setHistoryOpenSafe(open: boolean) {
    setHistoryOpen(open);
    if (!open) {
      setHistorySearchOpen(false);
      setHistoryQuery("");
    }
  }

  const historyItems = conversations.filter(
    (c) => c.messages.length > 0 || c.id === activeId,
  );
  const query = historyQuery.trim().toLowerCase();
  const filteredHistory = query
    ? historyItems.filter((c) => c.title.toLowerCase().includes(query))
    : historyItems;
  const pinnedHistory = filteredHistory.filter((c) => c.pinned);
  const recentHistory = filteredHistory.filter((c) => !c.pinned);

  function renderHistoryGroup(
    items: AgentConversation[],
    label?: string,
  ) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5">
        {label ? (
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        ) : null}
        {items.map((conversation) => (
          <HistoryConversationRow
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === activeId}
            busy={busy}
            onSelect={() => selectConversation(conversation)}
            onTogglePin={() => togglePinConversation(conversation.id)}
            onRename={(title) => renameConversation(conversation.id, title)}
            onDelete={() => deleteConversation(conversation.id)}
          />
        ))}
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const streamingAssistantId =
    status === "streaming" && lastMessage?.role === "assistant"
      ? lastMessage.id
      : null;

  const isEmpty =
    messages.length === 0 && !waitingForAssistant && !error;
  const suggestions = useMemo(
    () => getAgentSuggestions({ isWorkspace, productTitle }),
    [isWorkspace, productTitle],
  );

  return (
    <div className="relative h-full min-h-0">
      <div
        aria-hidden={!historyOpen}
        inert={historyOpen ? undefined : true}
        className={cn(
          "absolute inset-y-0 left-0 right-12 flex flex-col overflow-hidden",
          !historyOpen && "pointer-events-none",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-1 px-2">
          {historySearchOpen ? (
            <>
              <Search
                className="ml-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={historySearchRef}
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search chat history…"
                aria-label="Search chat history"
                className="h-full min-w-0 flex-1 bg-transparent px-2 font-heading text-[15px] font-semibold tracking-tight outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Clear search"
                aria-label="Clear search"
                onClick={closeHistorySearch}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <h2 className="min-w-0 flex-1 truncate px-2 font-heading text-[15px] font-semibold tracking-tight">
                Chat history
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Search chat history"
                aria-label="Search chat history"
                onClick={() => setHistorySearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
            </>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-2">
            {filteredHistory.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {query ? "No matching conversations." : "No conversations yet."}
              </p>
            ) : (
              <>
                {renderHistoryGroup(
                  pinnedHistory,
                  pinnedHistory.length > 0 ? "Pinned" : undefined,
                )}
                {renderHistoryGroup(
                  recentHistory,
                  pinnedHistory.length > 0 ? "Recent" : undefined,
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          "relative z-10 flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-canvas transition-transform duration-[250ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          historyOpen &&
            "translate-x-[calc(100%-3rem)] shadow-[-8px_0_24px_rgba(0,0,0,0.18)]",
        )}
        onClick={() => {
          if (historyOpen) setHistoryOpenSafe(false);
        }}
      >
        <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryOpenSafe(!historyOpen);
            }}
            title={historyOpen ? "Close chat history" : "Conversation history"}
            aria-label={
              historyOpen ? "Close chat history" : "Conversation history"
            }
            aria-expanded={historyOpen}
          >
            {historyOpen ? (
              <X className="size-5" />
            ) : (
              <History className="size-5" />
            )}
          </Button>

          <div className="pointer-events-none absolute left-1/2 flex max-w-[min(100%,14rem)] -translate-x-1/2 flex-col items-center text-center">
            <h1 className="font-heading text-sm font-semibold tracking-tight">
              Product Agent
            </h1>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {activeTitle}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              startNewConversation();
            }}
            disabled={busy || messages.length === 0}
            title="New conversation"
            aria-label="New conversation"
          >
            <SquarePen className="size-5" />
          </Button>
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity duration-[250ms] ease-out",
            historyOpen && "pointer-events-none opacity-0",
          )}
        >
          {isEmpty ? (
            <div className="flex min-h-0 flex-1 flex-col justify-end px-3 pb-1">
              <h2 className="px-3 pb-4 font-heading text-xl font-semibold tracking-tight">
                What can I help with?
              </h2>
              <AgentEmptySuggestions
                suggestions={suggestions}
                disabled={busy || walletBlocked || historyOpen}
                onSelect={handleSuggestionSelect}
              />
            </div>
          ) : (
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="flex-1">
                <MessageScrollerViewport preserveScrollOnPrepend>
                  <MessageScrollerContent
                    aria-busy={busy}
                    className="gap-3 px-3 py-3"
                  >
                    <LoadOlderSentinel
                      hasOlder={hasOlderMessages}
                      loading={loadingOlder}
                      onLoadOlder={loadOlderMessages}
                    />
                    {visibleMessages.map((message) => {
                      const isUser = message.role === "user";
                      const text = messageText(message);
                      const isStreamingMessage =
                        streamingAssistantId === message.id;
                      const creativeIds = isUser
                        ? []
                        : extractCreativeIdsFromMessage(message);
                      const insightIds = isUser
                        ? []
                        : extractInsightIdsFromMessage(message);
                      const creativeErrors = isUser
                        ? []
                        : extractCreativeToolErrors(message);
                      return (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                          scrollAnchor={isUser}
                        >
                          <Message align={isUser ? "end" : "start"}>
                            <MessageContent>
                              {isUser ? (
                                <Bubble
                                  variant="default"
                                  align="end"
                                  className="max-w-[92%]"
                                >
                                  <BubbleContent className="whitespace-pre-wrap px-3 text-[13px] leading-relaxed">
                                    {text || ""}
                                  </BubbleContent>
                                </Bubble>
                              ) : (
                                <div className="max-w-[92%] text-[13px] leading-relaxed">
                                  {text || isStreamingMessage ? (
                                    <AgentMessageMarkdown
                                      text={text || "…"}
                                      isAnimating={isStreamingMessage}
                                    />
                                  ) : busy ? (
                                    "…"
                                  ) : (
                                    ""
                                  )}
                                  {creativeErrors.map((err) => (
                                    <p
                                      key={err}
                                      className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive"
                                    >
                                      {formatCreativeToolError(
                                        err,
                                        walletCtx?.plan,
                                      )}
                                    </p>
                                  ))}
                                  {creativeIds.map((id) => (
                                    <CreativeCardFromId
                                      key={id}
                                      creativeId={id}
                                    />
                                  ))}
                                  {insightIds.map((id) => (
                                    <InsightCardFromId
                                      key={id}
                                      insightId={id}
                                    />
                                  ))}
                                </div>
                              )}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })}
                    {waitingForAssistant ? (
                      <MessageScrollerItem>
                        <Marker role="status">
                          <MarkerContent className="animate-pulse text-[13px]">
                            Thinking…
                          </MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ) : null}
                    {error ? (
                      <MessageScrollerItem>
                        <Marker role="alert">
                          <MarkerContent className="text-[13px] text-destructive">
                            {userFacingErrorMessage(error)}
                          </MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          )}

          <div
            className={cn(!isEmpty && "border-t border-border")}
            onClick={(e) => e.stopPropagation()}
          >
            <AgentComposerInput
              busy={busy}
              productId={productId}
              onSubmit={handleSend}
              placeholder={
                walletBlocked
                  ? "AI is paused — add credits or raise your usage limit"
                  : "Ask anything"
              }
            />
            <div className="flex items-center px-2 pb-2">
              <AgentModelSelect
                value={chatModel}
                onChange={handleChatModelChange}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
