"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DEFAULT_CHAT_MODEL,
  modelLogoUrl,
  type GatewayChatModel,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

type AgentModelSelectProps = {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
};

function ModelLogo({
  modelId,
  className,
}: {
  modelId: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- models.dev SVG logos
    <img
      src={modelLogoUrl(modelId)}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 dark:invert", className)}
      loading="lazy"
      decoding="async"
    />
  );
}

function matchesQuery(model: GatewayChatModel, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    model.id.toLowerCase().includes(q) ||
    model.name.toLowerCase().includes(q) ||
    model.provider.toLowerCase().includes(q) ||
    (model.description?.toLowerCase().includes(q) ?? false)
  );
}

export function AgentModelSelect({
  value,
  onChange,
  disabled,
}: AgentModelSelectProps) {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<GatewayChatModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch("/api/ai/models");
        if (!res.ok) throw new Error("Failed to load models");
        const body = (await res.json()) as { models?: GatewayChatModel[] };
        if (!cancelled) setModels(body.models ?? []);
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setModels([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const selected =
    models.find((m) => m.id === value) ??
    ({
      id: value || DEFAULT_CHAT_MODEL,
      name: value?.split("/")[1] || DEFAULT_CHAT_MODEL,
      description: null,
      provider: value?.split("/")[0] || "openai",
      contextWindow: null,
      maxTokens: null,
      tags: [],
      pricing: null,
      popular: false,
    } satisfies GatewayChatModel);

  const filtered = useMemo(
    () => models.filter((m) => matchesQuery(m, query.trim())),
    [models, query],
  );

  const popular = useMemo(
    () => filtered.filter((m) => m.popular),
    [filtered],
  );
  const rest = useMemo(
    () => filtered.filter((m) => !m.popular),
    [filtered],
  );

  const selectModel = useCallback(
    (modelId: string) => {
      onChange(modelId);
      setOpen(false);
    },
    [onChange],
  );

  function renderGroup(items: GatewayChatModel[], label: string) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5">
        <p className="px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {items.map((model) => {
          const isSelected = model.id === value;
          return (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted",
              )}
              onClick={() => selectModel(model.id)}
            >
              <ModelLogo modelId={model.id} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{model.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {model.id}
                </span>
              </span>
              {isSelected ? (
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-7 max-w-full gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
          />
        }
      >
        <ModelLogo modelId={selected.id} />
        <span className="min-w-0 truncate">{selected.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[min(100vw-2rem,20rem)] gap-1.5 p-1.5"
      >
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2">
          <Search
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            aria-label="Search models"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <ScrollArea className="h-64">
          <div
            id={listId}
            role="listbox"
            aria-label="AI models"
            className="flex flex-col gap-1 pr-2"
          >
            {loading ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Loading models…
              </p>
            ) : loadError ? (
              <p className="px-2 py-3 text-xs text-destructive">
                Couldn’t load models from AI Gateway.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No matching models.
              </p>
            ) : (
              <>
                {renderGroup(popular, "Popular")}
                {renderGroup(
                  rest,
                  popular.length > 0 ? "All models" : "Models",
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
