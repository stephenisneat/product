"use client";

import { useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight HTML highlighter for the install snippet (tags, attrs, strings).
 * Avoids pulling in a full syntax engine for a fixed script tag.
 */
function highlightHtml(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(<\/?[a-zA-Z][\w:-]*)|([a-zA-Z_:][\w:.-]*)(=)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/?>)|([^<="'>\s]+)|(\s+)/g;

  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(code)) !== null) {
    const [, tag, attr, eq, str, punct, other, space] = match;
    if (tag) {
      nodes.push(
        <span key={key++} className="text-sky-600 dark:text-sky-400">
          {tag}
        </span>,
      );
    } else if (attr && eq) {
      nodes.push(
        <span key={key++} className="text-violet-600 dark:text-violet-400">
          {attr}
        </span>,
      );
      nodes.push(
        <span key={key++} className="text-muted-foreground">
          {eq}
        </span>,
      );
    } else if (str) {
      nodes.push(
        <span key={key++} className="text-emerald-700 dark:text-emerald-400">
          {str}
        </span>,
      );
    } else if (punct) {
      nodes.push(
        <span key={key++} className="text-sky-600 dark:text-sky-400">
          {punct}
        </span>,
      );
    } else if (other) {
      nodes.push(
        <span key={key++} className="text-foreground">
          {other}
        </span>,
      );
    } else if (space) {
      nodes.push(space);
    }
  }
  return nodes;
}

export function SnippetCode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const selectAll = useCallback((el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  return (
    <pre
      role="textbox"
      tabIndex={0}
      aria-label="Plugin install snippet"
      aria-readonly="true"
      onClick={(e) => selectAll(e.currentTarget)}
      onFocus={(e) => selectAll(e.currentTarget)}
      className={cn(
        "cursor-text overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      <code className="whitespace-pre">{highlightHtml(code)}</code>
    </pre>
  );
}
