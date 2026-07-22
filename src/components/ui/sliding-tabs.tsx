"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

export type SlidingTabItem = {
  value: string;
  label: string;
};

/**
 * Segmented control with a sliding pill indicator (transitions.dev tabs-sliding).
 * Pill position/width are measured from the active tab; CSS owns the tween.
 */
export function SlidingTabs({
  value,
  onValueChange,
  items,
  className,
  "aria-label": ariaLabel = "Tabs",
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly SlidingTabItem[];
  className?: string;
  "aria-label"?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const animateNextSync = useRef(false);

  const moveTo = useCallback((tab: HTMLElement | null, animate: boolean) => {
    const pill = pillRef.current;
    if (!pill || !tab) return;

    const nextTransform = `translateX(${tab.offsetLeft}px)`;
    const nextWidth = `${tab.offsetWidth}px`;

    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = nextTransform;
      pill.style.width = nextWidth;
      void pill.offsetWidth;
      pill.style.transition = prev;
      return;
    }

    pill.style.transform = nextTransform;
    pill.style.width = nextWidth;
  }, []);

  const syncPill = useCallback(
    (animate: boolean) => {
      const active =
        tabRefs.current.get(value) ??
        tabRefs.current.get(items[0]?.value ?? "") ??
        null;
      moveTo(active, animate);
    },
    [items, moveTo, value],
  );

  useLayoutEffect(() => {
    const animate = animateNextSync.current;
    animateNextSync.current = false;
    syncPill(animate);
  }, [syncPill]);

  useEffect(() => {
    const onResize = () => syncPill(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncPill]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncPill(false));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [syncPill]);

  const pillStyle = {
    ["--tabs-dur" as string]: "250ms",
    ["--tabs-ease" as string]: "cubic-bezier(0.22, 1, 0.36, 1)",
  } as CSSProperties;

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-label={ariaLabel}
      style={pillStyle}
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-white/10 p-0.5",
        className,
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0 z-0 h-[30px] w-0 rounded-full bg-white/90 will-change-[transform,width] motion-reduce:transition-none"
        style={{
          transition:
            "transform var(--tabs-dur) var(--tabs-ease), width var(--tabs-dur) var(--tabs-ease)",
        }}
      />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) tabRefs.current.set(item.value, node);
              else tabRefs.current.delete(item.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "relative z-10 h-[30px] shrink-0 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-sm",
              "motion-reduce:transition-none",
              selected
                ? "text-neutral-950"
                : "text-neutral-300 hover:text-white",
            )}
            onClick={() => {
              if (item.value === value) return;
              animateNextSync.current = true;
              onValueChange(item.value);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
