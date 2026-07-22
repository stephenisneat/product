import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageCanvas({
  header,
  children,
  contentClassName,
  headerClassName,
  className,
  headerHeightClassName = "h-12",
  contentTopClassName = "top-12",
}: {
  header?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  className?: string;
  /** Height utility for the sticky header (must match contentTopClassName). */
  headerHeightClassName?: string;
  /** Top offset for scroll content (must match headerHeightClassName). */
  contentTopClassName?: string;
}) {
  return (
    <div className={cn("relative h-full min-h-0", className)}>
      {header ? (
        <div
          className={cn(
            "absolute top-0 z-10 flex w-full items-center border-b border-border bg-canvas/95 px-4 backdrop-blur supports-backdrop-filter:bg-canvas/80",
            headerHeightClassName,
            headerClassName,
          )}
        >
          {header}
        </div>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 overflow-y-auto",
          header ? contentTopClassName : "top-0",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
