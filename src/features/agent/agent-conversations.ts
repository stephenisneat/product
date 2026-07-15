import type { UIMessage } from "ai";

export type AgentConversation = {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
};

type ConversationStore = {
  activeId: string;
  conversations: AgentConversation[];
};

function storageKey(userId: string) {
  return `agent-conversations:${userId}`;
}

function newId() {
  return `chat_${crypto.randomUUID().slice(0, 10)}`;
}

export function createEmptyConversation(): AgentConversation {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title: "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function titleFromMessages(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = messageText(message).trim().replace(/\s+/g, " ");
    if (!text) continue;
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  return "New conversation";
}

export function messageText(message: {
  parts?: Array<{ type: string; text?: string }>;
  content?: unknown;
}): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  if (typeof message.content === "string") return message.content;
  return "";
}

export function loadConversationStore(userId: string): ConversationStore {
  if (typeof window === "undefined") {
    const empty = createEmptyConversation();
    return { activeId: empty.id, conversations: [empty] };
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) {
      const empty = createEmptyConversation();
      const store = { activeId: empty.id, conversations: [empty] };
      saveConversationStore(userId, store);
      return store;
    }

    const parsed = JSON.parse(raw) as ConversationStore;
    if (
      !parsed ||
      typeof parsed.activeId !== "string" ||
      !Array.isArray(parsed.conversations) ||
      parsed.conversations.length === 0
    ) {
      const empty = createEmptyConversation();
      const store = { activeId: empty.id, conversations: [empty] };
      saveConversationStore(userId, store);
      return store;
    }

    if (!parsed.conversations.some((c) => c.id === parsed.activeId)) {
      parsed.activeId = parsed.conversations[0]!.id;
    }

    return parsed;
  } catch {
    const empty = createEmptyConversation();
    return { activeId: empty.id, conversations: [empty] };
  }
}

export function saveConversationStore(userId: string, store: ConversationStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(store));
}

export function upsertConversation(
  store: ConversationStore,
  conversation: AgentConversation,
): ConversationStore {
  const index = store.conversations.findIndex((c) => c.id === conversation.id);
  const conversations =
    index === -1
      ? [conversation, ...store.conversations]
      : store.conversations.map((c, i) => (i === index ? conversation : c));

  return {
    activeId: conversation.id,
    conversations: conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  };
}

export function getActiveConversation(
  store: ConversationStore,
): AgentConversation {
  return (
    store.conversations.find((c) => c.id === store.activeId) ??
    store.conversations[0]!
  );
}
