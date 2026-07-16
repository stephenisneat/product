"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import type { Workspace, WorkspacePlan, WorkspaceRole } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { CreateWorkspaceDialog } from "@/features/workspaces/create-workspace-dialog";
import { WorkspaceAvatar } from "@/features/workspaces/workspace-avatar";
import type { WorkspaceWithRole } from "@/repositories/types";
import { cn } from "@/lib/utils";

const optionItemClass =
  "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground";

function planBadgeClass(plan: WorkspacePlan) {
  if (plan === "pro") {
    return "border-blue-500/30 bg-blue-500/40 text-blue-800 dark:text-blue-100 font-semibold";
  }
  return "border-yellow-500/30 bg-yellow-500/40 text-yellow-800 dark:text-yellow-100 font-semibold";
}

export function WorkspacePicker({
  workspaces,
  activeWorkspaceId,
  activeRole,
  userEmail,
  plan: planOverride,
  variant = "default",
}: {
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string;
  activeRole: WorkspaceRole;
  userEmail: string;
  /** Optional override; defaults to the active workspace plan. */
  plan?: WorkspacePlan;
  variant?: "default" | "header";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [discoverable, setDiscoverable] = useState<Workspace[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const active =
    workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0];
  const plan = planOverride ?? active?.plan ?? "free";
  const canManage = activeRole === "owner" || activeRole === "admin";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workspaces/discoverable");
        if (!res.ok) return;
        const body = (await res.json()) as { workspaces?: Workspace[] };
        if (!cancelled) setDiscoverable(body.workspaces ?? []);
      } catch {
        if (!cancelled) setDiscoverable([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!active) return null;

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

  async function joinWorkspace(workspaceId: string) {
    setJoiningId(workspaceId);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Failed to join workspace");
      }
      setDiscoverable((prev) => prev.filter((ws) => ws.id !== workspaceId));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant={variant === "header" ? "ghost" : "outline"}
              size="sm"
              disabled={pending}
              className={cn(
                "gap-1.5",
                variant === "header" &&
                  "h-8 px-1.5 text-foreground hover:bg-white/5",
              )}
            />
          }
        >
          {variant === "header" ? (
            <WorkspaceAvatar
              name={active.name}
              avatarUrl={active.avatarUrl}
              size="sm"
            />
          ) : null}
          <span
            className={cn(
              "min-w-12 truncate text-left",
              variant === "header" ? "max-w-28 font-medium" : "max-w-20",
            )}
          >
            {active.name}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "h-4 px-1.5 text-[10px] font-normal",
              planBadgeClass(plan),
            )}
          >
            {plan === "pro" ? "Pro" : "Free"}
          </Badge>
          {variant === "header" ? (
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronsUpDownIcon data-icon="inline-end" />
          )}
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
                <WorkspaceAvatar
                  name={ws.name}
                  avatarUrl={ws.avatarUrl}
                  size="sm"
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

          {discoverable.length > 0 ? (
            <>
              <Separator className="my-2" />
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                Available to join
              </p>
              <div className="space-y-0.5">
                {discoverable.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center gap-2 rounded-md py-1.5 pr-2 pl-2"
                  >
                    <WorkspaceAvatar
                      name={ws.name}
                      avatarUrl={ws.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {ws.name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={joiningId === ws.id}
                      onClick={() => void joinWorkspace(ws.id)}
                    >
                      {joiningId === ws.id ? "Joining…" : "Join"}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <Separator className="my-2" />
          <button
            type="button"
            className={optionItemClass}
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            Create workspace
          </button>
          {canManage ? (
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
          ) : null}
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-[10px] text-destructive">{error}</p>
      ) : null}
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        userEmail={userEmail}
      />
    </div>
  );
}
