"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, ChevronsUpDownIcon, SettingsIcon } from "lucide-react";
import type { WorkspaceRole } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { WorkspaceWithRole } from "@/repositories/types";
import { cn } from "@/lib/utils";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

export function WorkspacePicker({
  workspaces,
  activeWorkspaceId,
  activeRole,
}: {
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string;
  activeRole: WorkspaceRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active =
    workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0];
  if (!active) return null;

  const canManage = activeRole === "owner" || activeRole === "admin";

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    setError(null);
    setOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/workspaces/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error || "Failed to switch workspace");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="max-w-[14rem]"
            />
          }
        >
          <span className="truncate">{active.name}</span>
          <ChevronsUpDownIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent align="start" className="min-w-56 p-2">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Workspaces
          </p>
          <div className="space-y-0.5">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                className={optionItemClass}
                onClick={() => void switchWorkspace(ws.id)}
              >
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    activeWorkspaceId === ws.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{ws.name}</span>
                  <span className="text-[10px] capitalize text-muted-foreground">
                    {ws.role}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {canManage ? (
            <>
              <Separator className="my-2" />
              <button
                type="button"
                className={optionItemClass}
                onClick={() => {
                  setOpen(false);
                  router.push("/settings/workspace");
                }}
              >
                <SettingsIcon className="size-4" />
                Workspace settings
              </button>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-[10px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
