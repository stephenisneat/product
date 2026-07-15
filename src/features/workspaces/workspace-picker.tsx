"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronsUpDownIcon, SettingsIcon } from "lucide-react";
import type { WorkspaceRole } from "@/domain";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceWithRole } from "@/repositories/types";

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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active =
    workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0];
  if (!active) return null;

  const canManage = activeRole === "owner" || activeRole === "admin";

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    setError(null);
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
      <DropdownMenu>
        <DropdownMenuTrigger
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeWorkspaceId}
              onValueChange={(value) => {
                if (value) void switchWorkspace(value);
              }}
            >
              {workspaces.map((ws) => (
                <DropdownMenuRadioItem key={ws.id} value={ws.id}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {ws.role}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings/workspace")}
              >
                <SettingsIcon />
                Workspace settings
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p className="text-[10px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
