"use client";

import { layout, prepare } from "@chenglou/pretext";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type EditorState,
} from "lexical";
import {
  BeautifulMentionNode,
  BeautifulMentionsPlugin,
  type BeautifulMentionsItem,
  type BeautifulMentionsMenuItemProps,
  type BeautifulMentionsMenuProps,
} from "lexical-beautiful-mentions";
import { Loader2, Paperclip, Plus, Send, X } from "@/components/icons";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgentContext } from "@/features/agent/agent-context";

/** Matches `text-[13px] leading-5` on the contenteditable. */
const EDITOR_FONT = '13px Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif';
const EDITOR_LINE_HEIGHT = 20;
/** `px-11` each side while buttons overlay the pill. */
const PILL_SIDE_GUTTER = 44;

const mentionTheme = {
  beautifulMentions: {
    "@":
      "inline rounded-md bg-muted px-1 py-0.5 font-medium text-foreground",
    "@Focused":
      "inline rounded-md bg-accent px-1 py-0.5 font-medium text-accent-foreground",
  },
};

function MentionsMenu({
  loading,
  children,
  ...props
}: BeautifulMentionsMenuProps) {
  return (
    <ul
      className="absolute z-50 mt-1 max-h-56 min-w-56 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
      {...props}
    >
      {loading ? (
        <li className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</li>
      ) : null}
      {children}
    </ul>
  );
}

const MentionsMenuItem = forwardRef<
  HTMLLIElement,
  BeautifulMentionsMenuItemProps
>(function MentionsMenuItem(
  {
    selected,
    item,
    itemValue: _itemValue,
    label: _label,
    // Mention search data is spread onto the item; keep it off the DOM node.
    value: _value,
    type: _type,
    id: _id,
    ...props
  },
  ref,
) {
  const type =
    typeof item.data?.type === "string" ? item.data.type : "mention";

  return (
    <li
      ref={ref}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{item.value}</span>
      <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
        {type}
      </span>
    </li>
  );
});

function MentionsEmpty() {
  return (
    <div className="px-2 py-1.5 text-xs text-muted-foreground">No matches</div>
  );
}

function EnterSubmitPlugin({
  onSubmit,
  disabled,
}: {
  onSubmit: () => void;
  disabled: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!event || event.shiftKey) return false;
        event.preventDefault();
        if (!disabled) onSubmit();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [disabled, editor, onSubmit]);

  return null;
}

function EditorResetPlugin({
  resetSignal,
}: {
  resetSignal: number;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (resetSignal === 0) return;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });
  }, [editor, resetSignal]);

  return null;
}

function PrefillPlugin({
  prefill,
  onConsumed,
}: {
  prefill: string | null;
  onConsumed: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!prefill) return;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(prefill));
      root.append(paragraph);
    });
    onConsumed();
  }, [editor, onConsumed, prefill]);

  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editable, editor]);

  return null;
}

/** Keeps React layout mode in sync before paint so the pill never grows tall. */
function ComposerLayoutPlugin({
  shellWidthRef,
  multilineRef,
  onLayoutChange,
}: {
  shellWidthRef: React.MutableRefObject<number>;
  multilineRef: React.MutableRefObject<boolean>;
  onLayoutChange: (text: string, multiline: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const nextText = readEditorText(editorState);
      const nextMultiline = isMultilineText(nextText, shellWidthRef.current);
      const sync = () => onLayoutChange(nextText, nextMultiline);

      // Only block paint when crossing the pill → box boundary.
      if (nextMultiline !== multilineRef.current) {
        flushSync(sync);
      } else {
        sync();
      }
    });
  }, [editor, multilineRef, onLayoutChange, shellWidthRef]);

  return null;
}

function readEditorText(editorState: EditorState) {
  let text = "";
  editorState.read(() => {
    text = $getRoot().getTextContent().replace(/\u200b/g, "");
  });
  return text;
}

function isMultilineText(text: string, shellWidth: number) {
  const normalized = text.replace(/\u200b/g, "");
  if (!normalized.trim()) return false;
  if (normalized.includes("\n")) return true;

  const pillWidth = shellWidth - PILL_SIDE_GUTTER * 2;
  if (pillWidth <= 0) return false;

  const prepared = prepare(normalized, EDITOR_FONT, {
    whiteSpace: "pre-wrap",
  });
  const { lineCount } = layout(prepared, pillWidth, EDITOR_LINE_HEIGHT);
  return lineCount > 1;
}

async function searchMentions(
  _trigger: string,
  query: string | null,
  productId?: string,
): Promise<BeautifulMentionsItem[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (productId) params.set("productId", productId);

  try {
    const res = await fetch(`/api/agent/mentions?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{ value: string; id: string; type: string }>;
    };
    return (data.items ?? []).map((item) => ({
      value: item.value,
      id: item.id,
      type: item.type,
    }));
  } catch {
    return [];
  }
}

export function AgentComposerInput({
  placeholder,
  disabled,
  busy,
  productId,
  onSubmit,
  className,
}: {
  placeholder: string;
  disabled?: boolean;
  busy: boolean;
  productId?: string;
  onSubmit: (payload: { text: string; files: File[] }) => void | Promise<void>;
  className?: string;
}) {
  const { composePrefill, setComposePrefill } = useAgentContext();
  const [text, setText] = useState("");
  const [multiline, setMultiline] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shellWidthRef = useRef(0);
  const textRef = useRef("");
  const multilineRef = useRef(false);
  const formId = useId();

  const initialConfig = useMemo(
    () => ({
      namespace: `agent-composer-${formId}`,
      theme: mentionTheme,
      nodes: [BeautifulMentionNode],
      onError(error: Error) {
        console.error(error);
      },
    }),
    [formId],
  );

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      shellWidthRef.current = width;
      setMultiline((prev) => {
        const next = isMultilineText(textRef.current, width);
        multilineRef.current = next;
        return prev === next ? prev : next;
      });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onLayoutChange = useCallback((nextText: string, nextMultiline: boolean) => {
    textRef.current = nextText;
    multilineRef.current = nextMultiline;
    setText(nextText);
    setMultiline(nextMultiline);
  }, []);

  const canSend =
    (text.trim().length > 0 || files.length > 0) && !busy && !disabled;

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    const nextText = text.trim();
    const nextFiles = files;
    textRef.current = "";
    multilineRef.current = false;
    setText("");
    setMultiline(false);
    setFiles([]);
    setResetSignal((n) => n + 1);
    void onSubmit({ text: nextText, files: nextFiles });
  }, [canSend, files, onSubmit, text]);

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const onSearch = useCallback(
    (trigger: string, query?: string | null) =>
      searchMentions(trigger, query ?? null, productId),
    [productId],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={onFormSubmit} className={cn("p-3 pb-1.5", className)}>
      {files.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pr-1 pl-2 text-[11px]"
            >
              <Paperclip className="size-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{file.name}</span>
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length > 0) {
            setFiles((prev) => [...prev, ...selected]);
          }
          e.target.value = "";
        }}
      />

      <LexicalComposer initialConfig={initialConfig}>
        <div
          ref={shellRef}
          className={cn(
            "relative flex flex-col border border-input bg-background dark:bg-input/30",
            multiline ? "rounded-xl" : "h-10 overflow-hidden rounded-full",
            disabled && "opacity-50",
          )}
        >
          <div
            className={cn(
              "relative",
              multiline ? "min-h-10 px-3 pt-2.5 pb-1" : "h-10 px-11 py-2",
            )}
          >
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  aria-label={placeholder}
                  className={cn(
                    "relative z-[1] text-[13px] leading-5 outline-none",
                    "whitespace-pre-wrap break-words",
                    multiline
                      ? "max-h-40 min-h-5 overflow-y-auto"
                      : "h-5 overflow-hidden",
                  )}
                />
              }
              placeholder={null}
              ErrorBoundary={LexicalErrorBoundary}
            />

            {!text.trim() ? (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute z-0 truncate text-[13px] leading-5 text-muted-foreground",
                  multiline
                    ? "top-2.5 right-3 left-3"
                    : "top-1/2 right-11 left-11 -translate-y-1/2",
                )}
              >
                {placeholder}
              </div>
            ) : null}

            <ComposerLayoutPlugin
              shellWidthRef={shellWidthRef}
              multilineRef={multilineRef}
              onLayoutChange={onLayoutChange}
            />
            <HistoryPlugin />
            <EnterSubmitPlugin onSubmit={handleSubmit} disabled={!canSend} />
            <EditorResetPlugin resetSignal={resetSignal} />
            <PrefillPlugin
              prefill={composePrefill}
              onConsumed={() => setComposePrefill(null)}
            />
            <EditablePlugin editable={!disabled} />
            <BeautifulMentionsPlugin
              triggers={["@"]}
              onSearch={onSearch}
              searchDelay={200}
              menuItemLimit={8}
              allowSpaces
              insertOnBlur={false}
              creatable={false}
              menuComponent={MentionsMenu}
              menuItemComponent={MentionsMenuItem}
              emptyComponent={MentionsEmpty}
              menuAnchorClassName="z-50"
            />
          </div>

          <div
            className={cn(
              multiline
                ? "flex items-center justify-between px-1.5 pb-1.5"
                : "contents",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || busy}
              title="Attach file"
              aria-label="Attach file"
              className={cn(
                "rounded-full",
                !multiline &&
                  "absolute top-1/2 left-1 z-10 -translate-y-1/2",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="size-4" />
            </Button>

            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend}
              title="Send message"
              aria-label="Send message"
              className={cn(
                "rounded-full",
                !multiline &&
                  "absolute top-1/2 right-1 z-10 -translate-y-1/2",
              )}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </LexicalComposer>
    </form>
  );
}
