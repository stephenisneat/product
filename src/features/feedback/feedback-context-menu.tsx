"use client";

import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFeedback } from "@/features/feedback/feedback-context";
import { cn } from "@/lib/utils";

export function FeedbackContextMenu({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { recordContextPoint, lastContextPoint, startPinMode, openFeedback } =
    useFeedback();

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(className)}
        onContextMenu={(event) => {
          recordContextPoint({ x: event.clientX, y: event.clientY });
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52" data-feedback-ui="">
        <ContextMenuItem
          onClick={() => {
            const point = lastContextPoint();
            if (point) startPinMode(point);
            else startPinMode();
          }}
        >
          Give feedback here
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openFeedback({ kind: "bug" })}>
          Report a bug
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openFeedback({ kind: "feature" })}>
          Request a feature
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
