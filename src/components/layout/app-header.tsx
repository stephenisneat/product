"use client";

import Link from "next/link";
import { SettingsIcon } from "lucide-react";
import type { AppUser, WorkspaceRole } from "@/domain";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { ChannelsMenu } from "@/features/channels/channels-menu";
import { ProductPluginMenu } from "@/features/plugin/product-plugin-menu";
import { WalletMenu } from "@/features/wallet/wallet-menu";
import { WorkspacePicker } from "@/features/workspaces/workspace-picker";
import type { WorkspaceWithRole } from "@/repositories/types";

export function AppHeader({
  user,
  workspaces,
  activeWorkspaceId,
  activeRole,
}: {
  user: AppUser;
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 items-center gap-2">
        {activeWorkspaceId && activeRole ? (
          <WorkspacePicker
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            activeRole={activeRole}
            userEmail={user.email}
            variant="header"
          />
        ) : (
          <span className="font-heading text-sm font-medium tracking-tight">
            Product Agent
          </span>
        )}
        <div className="flex items-center gap-2">
          <ChannelsMenu />
          <ProductPluginMenu />
          <WalletMenu />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          render={
            <Link
              href={
                activeWorkspaceId
                  ? "/settings/workspace"
                  : "/settings/account"
              }
            />
          }
          variant="outline"
          size="icon-sm"
          aria-label="Settings"
        >
          <SettingsIcon />
        </Button>
        <UserMenu user={user} showLabel />
      </div>
    </header>
  );
}
