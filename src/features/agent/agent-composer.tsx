"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/domain";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

function messageText(message: {
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

export function AgentComposer({
  user,
  productId,
  productTitle,
}: {
  user: AppUser;
  productId?: string;
  productTitle?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const isWorkspace = !productId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: productId ? { productId } : {},
      }),
    [productId],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: () => {
      router.refresh();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-card/20">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Agent</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {isWorkspace ? "Workspace" : (productTitle ?? "Product")}
          </p>
        </div>
        <UserMenu user={user} />
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              {isWorkspace
                ? "Ask about your catalog, prioritize products, or request proposals across the workspace."
                : "Ask for positioning, ad copy, or a campaign concept. Proposals appear as reviewable artifacts."}
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
              : "Propose Meta ad copy for this product…"
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
          <Button type="submit" size="sm" disabled={busy || !input.trim()} className="gap-1.5">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
