import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

function storageKey(userId: string) {
  return `agent-chat-model:${userId}`;
}

export function loadPreferredChatModel(userId: string): string {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw && raw.includes("/")) return raw;
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_CHAT_MODEL;
}

export function savePreferredChatModel(userId: string, modelId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), modelId);
  } catch {
    // ignore quota / private mode
  }
}
