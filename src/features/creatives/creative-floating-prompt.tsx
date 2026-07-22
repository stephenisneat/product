"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Creative } from "@/domain";
import { AgentComposerInput } from "@/features/agent/agent-composer-input";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { userFacingErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function CreativeFloatingPrompt({
  creative,
  activeTab,
  productId,
  onCreativeChange,
  className,
}: {
  creative: Creative;
  activeTab: string;
  productId?: string;
  onCreativeChange: (creative: Creative) => void;
  className?: string;
}) {
  const router = useRouter();
  const chatModelRef = useRef(DEFAULT_CHAT_MODEL);
  const creativeRef = useRef(creative);
  const tabRef = useRef(activeTab);

  useEffect(() => {
    creativeRef.current = creative;
  }, [creative]);

  useEffect(() => {
    tabRef.current = activeTab;
  }, [activeTab]);

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
            creativeId: creativeRef.current.id,
            creativeTab: tabRef.current,
          },
        }),
      }),
    [productId],
  );

  const { sendMessage, status } = useChat({
    id: `creative-${creative.id}`,
    transport,
    onFinish: () => {
      void (async () => {
        try {
          const res = await fetch(`/api/creatives/${creative.id}`);
          if (!res.ok) return;
          const body = (await res.json()) as { creative?: Creative };
          if (body.creative) onCreativeChange(body.creative);
        } catch {
          // ignore refresh errors
        }
        router.refresh();
      })();
    },
    onError: (err) => {
      toast.error(userFacingErrorMessage(err));
    },
  });

  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    async ({ text, files }: { text: string; files: File[] }) => {
      if ((!text && files.length === 0) || busy) return;
      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        for (const file of files) dataTransfer.items.add(file);
        await sendMessage({ text: text || " ", files: dataTransfer.files });
        return;
      }
      await sendMessage({ text });
    },
    [busy, sendMessage],
  );

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
        className,
      )}
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-950/90 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <AgentComposerInput
          placeholder="Ask the agent to edit this creative…"
          busy={busy}
          productId={productId}
          className="p-2.5 pb-2"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
