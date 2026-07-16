import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageCanvas({
  header,
  children,
  contentClassName,
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full min-h-0", className)}>
      {header ? (
        <div className="absolute top-0 z-10 flex h-14 w-full items-center border-b border-border bg-canvas/95 px-4 backdrop-blur supports-backdrop-filter:bg-canvas/80">
          {header}
        </div>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 overflow-y-auto",
          header ? "top-14" : "top-0",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
