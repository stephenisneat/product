"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { History, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/domain";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const productId = route.mode === "product" ? route.productId : undefined;
  const productTitle =
    route.mode === "product" ? route.productTitle : undefined;
  const isWorkspace = !productId;

  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
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
    },
  });

  const busy = status === "submitted" || status === "streaming";

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
  }

  function selectConversation(conversation: AgentConversation) {
    if (busy || conversation.id === activeId) return;

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
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  const historyItems = conversations.filter(
    (c) => c.messages.length > 0 || c.id === activeId,
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex items-center gap-1 border-b border-border px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={startNewConversation}
            disabled={busy || messages.length === 0}
            title="New conversation"
            aria-label="New conversation"
          >
            <MessageSquarePlus className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Conversation history"
                  aria-label="Conversation history"
                />
              }
            >
              <History className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Conversation history</DropdownMenuLabel>
                {historyItems.length === 0 ? (
                  <div className="px-1.5 py-2 text-xs text-muted-foreground">
                    No conversations yet.
                  </div>
                ) : (
                  historyItems.map((conversation) => (
                    <DropdownMenuItem
                      key={conversation.id}
                      onClick={() => selectConversation(conversation)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="w-full truncate text-sm">
                        {conversation.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {conversation.id === activeId
                          ? "Current"
                          : formatUpdatedAt(conversation.updatedAt)}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-heading text-sm font-semibold tracking-tight">
          Product Agent
        </h1>
        <UserMenu user={user} />
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

      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isWorkspace
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
  );
}
