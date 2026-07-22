"use client";

import { LifebuoyIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFeedback } from "@/features/feedback/feedback-context";

export function FeedbackHeaderMenu() {
  const { openFeedback, startPinMode } = useFeedback();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Feedback"
            className="text-neutral-400"
          />
        }
      >
        <LifebuoyIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={() => openFeedback({ kind: "bug" })}>
          Report a bug
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openFeedback({ kind: "feature" })}>
          Request a feature
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startPinMode()}>
          Pinpoint on screen…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
