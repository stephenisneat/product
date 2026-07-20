"use client";

import { CornerDownLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type AgentSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export function getAgentSuggestions(options: {
  isWorkspace: boolean;
  productTitle?: string;
}): AgentSuggestion[] {
  if (options.isWorkspace) {
    return [
      {
        id: "capabilities",
        label: "What can Product Agent do?",
        prompt: "What can Product Agent do?",
      },
      {
        id: "prioritize",
        label: "Prioritize products across the catalog",
        prompt:
          "Prioritize products across the catalog and tell me where to focus first.",
      },
      {
        id: "improve",
        label: "What should we improve across the catalog?",
        prompt: "What should we improve across the catalog?",
      },
      {
        id: "insights",
        label: "Propose insights for top products",
        prompt: "Propose insights for the top products that need attention.",
      },
      {
        id: "campaigns",
        label: "Suggest campaign concepts worth testing",
        prompt: "Suggest campaign concepts worth testing across the catalog.",
      },
    ];
  }

  const title = options.productTitle?.trim() || "this product";
  return [
    {
      id: "capabilities",
      label: "What can Product Agent do?",
      prompt: "What can Product Agent do?",
    },
    {
      id: "positioning",
      label: `Sharpen positioning for ${title}`,
      prompt: `Sharpen the positioning for ${title}.`,
    },
    {
      id: "ask",
      label: `Ask something about ${title}`,
      prompt: `What should I know about ${title} before writing ads?`,
    },
    {
      id: "follow-ups",
      label: "Suggest follow-ups",
      prompt: `Suggest follow-ups for ${title}.`,
    },
    {
      id: "ad-copy",
      label: "Write sharper ad copy",
      prompt: `Write sharper ad copy for ${title}.`,
    },
  ];
}

function fieldHasText(target: HTMLElement) {
  if (target.isContentEditable) {
    return (target.textContent?.replace(/\u200b/g, "").trim() ?? "").length > 0;
  }
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
    return Boolean(
      (target as HTMLInputElement | HTMLTextAreaElement).value.trim(),
    );
  }
  return false;
}

export function AgentEmptySuggestions({
  suggestions,
  disabled,
  onSelect,
}: {
  suggestions: AgentSuggestion[];
  disabled?: boolean;
  onSelect: (suggestion: AgentSuggestion) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (suggestions.length === 0) return;
      setSelectedIndex(
        (prev) => (prev + delta + suggestions.length) % suggestions.length,
      );
    },
    [suggestions.length],
  );

  useEffect(() => {
    if (disabled || suggestions.length === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't steal keys from history search / rename inputs.
      if (
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        !target.isContentEditable
      ) {
        return;
      }

      // Once the user is typing in the composer, leave Enter/arrows alone.
      if (fieldHasText(target)) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const suggestion = suggestions[selectedIndex];
        if (!suggestion) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect(suggestion);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [disabled, moveSelection, onSelect, selectedIndex, suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-1 px-1 pb-2"
      role="listbox"
      aria-label="Suggested prompts"
    >
      {suggestions.map((suggestion, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => onSelect(suggestion)}
            className={cn(
              "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors",
              "text-muted-foreground hover:bg-neutral-700 hover:text-foreground",
              selected && "bg-neutral-700 text-foreground",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
            {selected ? (
              <CornerDownLeft
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
