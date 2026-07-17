"use client";

import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

export function AgentMessageMarkdown({
  text,
  isAnimating = false,
  className,
}: {
  text: string;
  isAnimating?: boolean;
  className?: string;
}) {
  return (
    <Streamdown
      mode={isAnimating ? "streaming" : "static"}
      isAnimating={isAnimating}
      className={cn(
        "space-y-2 text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background/60 [&_pre]:p-2.5",
        "[&_code]:rounded [&_code]:bg-background/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-[13px] [&_h3]:font-semibold",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2.5 [&_blockquote]:text-muted-foreground",
        className,
      )}
    >
      {text}
    </Streamdown>
  );
}
