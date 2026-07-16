"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { History, Loader2, Send, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AppUser } from "@/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentContext } from "@/features/agent/agent-context";
import {
  createEmptyConversation,
  getActiveConversation,
  loadConversationStore,
  messageText,
  saveConversationStore,
  titleFromMessages,
  upsertConversation,
  type AgentConversation,
} from "@/features/agent/agent-conversations";
import { useWalletOptional } from "@/features/wallet/wallet-context";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgentComposer({ user }: { user: AppUser }) {
  const router = useRouter();
  const { route } = useAgentContext();
  const walletCtx = useWalletOptional();
  const productId = route.mode === "product" ? route.productId : undefined;
  const productTitle =
    route.mode === "product" ? route.productTitle : undefined;
  const isWorkspace = !productId;

  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeId, setActiveId] = useState(() => createEmptyConversation().id);
  const [seedMessages, setSeedMessages] = useState<UIMessage[]>([]);

  const productIdRef = useRef(productId);
  productIdRef.current = productId;

  const messagesRef = useRef<UIMessage[]>([]);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    const store = loadConversationStore(user.id);
    const active = getActiveConversation(store);
    setConversations(store.conversations);
    setActiveId(active.id);
    setSeedMessages(active.messages);
    setHydrated(true);
  }, [user.id]);

  useEffect(() => {
    if (!historyOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setHistoryOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: {
            id,
            messages,
            ...(productIdRef.current
              ? { productId: productIdRef.current }
              : {}),
          },
        }),
      }),
    [],
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
      const msg = err.message || "";
      if (
        msg.includes("402") ||
        msg.includes("wallet_blocked") ||
        msg.includes("Wallet blocked")
      ) {
        walletCtx?.revealBlockedBanner();
        toast.error(
          "AI is blocked until you add credits or raise your usage limit.",
        );
        void walletCtx?.refresh();
        return;
      }
      toast.error(msg || "Something went wrong");
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const walletBlocked = walletCtx?.wallet?.blocked === true;

  messagesRef.current = messages;

  useEffect(() => {
    if (!hydrated || busy) return;

    const title = titleFromMessages(messages);
    const now = new Date().toISOString();

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeId);
      const nextConversation: AgentConversation = {
        id: activeId,
        title,
        messages,
        createdAt: existing?.createdAt ?? now,
        updatedAt: messages.length > 0 ? now : (existing?.updatedAt ?? now),
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
    const title = titleFromMessages(currentMessages);
    const now = new Date().toISOString();

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id);
      const nextConversation: AgentConversation = {
        id,
        title,
        messages: currentMessages,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
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
    setInput("");
    setHistoryOpen(false);
  }

  function selectConversation(conversation: AgentConversation) {
    if (busy) return;
    if (conversation.id === activeId) {
      setHistoryOpen(false);
      return;
    }

    persistCurrent();
    setSeedMessages(conversation.messages);
    setActiveId(conversation.id);
    setConversations((prev) => {
      const nextStore = {
        activeId: conversation.id,
        conversations: prev,
      };
      saveConversationStore(user.id, nextStore);
      return prev;
    });
    setInput("");
    setHistoryOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (walletBlocked) {
      walletCtx?.revealBlockedBanner();
      toast.error(
        "AI is blocked until you add credits or raise your usage limit.",
      );
      return;
    }
    setInput("");
    await sendMessage({ text });
  }

  const historyItems = conversations.filter(
    (c) => c.messages.length > 0 || c.id === activeId,
  );

  return (
    <div className="relative h-full min-h-0">
      <div
        aria-hidden={!historyOpen}
        inert={historyOpen ? undefined : true}
        className={cn(
          "absolute inset-0 flex flex-col overflow-hidden",
          !historyOpen && "pointer-events-none",
        )}
      >
        <div className="flex h-14 shrink-0 items-center px-4">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Conversations
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col p-2">
            {historyItems.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              historyItems.map((conversation) => {
                const isActive = conversation.id === activeId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    disabled={busy}
                    onClick={() => selectConversation(conversation)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted/60",
                      busy && "opacity-50",
                    )}
                  >
                    <span className="w-full truncate text-sm">
                      {conversation.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {isActive
                        ? "Current"
                        : formatUpdatedAt(conversation.updatedAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          "relative z-10 flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-canvas transition-transform duration-300 ease-out",
          historyOpen &&
            "translate-x-[calc(100%-2.75rem)] shadow-[-8px_0_24px_rgba(0,0,0,0.18)]",
        )}
        onClick={() => {
          if (historyOpen) setHistoryOpen(false);
        }}
      >
        <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryOpen((open) => !open);
            }}
            title="Conversation history"
            aria-label="Conversation history"
            aria-expanded={historyOpen}
          >
            <History className="size-5" />
          </Button>

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-heading text-sm font-semibold tracking-tight">
            Product Agent
          </h1>

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

        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                {isWorkspace
                  ? "Ask about your catalog, prioritize products, or request proposals across the workspace."
                  : `Ask about ${productTitle ?? "this product"} — positioning, ad copy, or a campaign concept.`}
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-6 rounded-md bg-primary px-2.5 py-2 text-xs text-primary-foreground"
                    : "mr-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed"
                }
              >
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wide opacity-60">
                  {message.role}
                </p>
                <div className="whitespace-pre-wrap">{messageText(message)}</div>
              </div>
            ))}
            {error ? (
              <p className="text-xs text-destructive">{error.message}</p>
            ) : null}
          </div>
        </ScrollArea>

        <form
          onSubmit={onSubmit}
          onClick={(e) => e.stopPropagation()}
          className="border-t border-border p-3"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              walletBlocked
                ? "AI is paused — add credits or raise your usage limit"
                : isWorkspace
                  ? "What should we improve across the catalog?"
                  : `Propose Meta ad copy for ${productTitle ?? "this product"}…`
            }
            rows={3}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e);
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={busy || !input.trim()}
              className="gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
