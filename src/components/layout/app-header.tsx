"use client";

import Link from "next/link";
import { SettingsIcon } from "@/components/icons";
import type { AppUser, WorkspaceRole } from "@/domain";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { ChannelsMenu } from "@/features/channels/channels-menu";
import { FeedbackHeaderMenu } from "@/features/feedback/feedback-header-menu";
import { ProductPluginMenu } from "@/features/plugin/product-plugin-menu";
import { WalletMenu } from "@/features/wallet/wallet-menu";
import { WorkspacePicker } from "@/features/workspaces/workspace-picker";
import type { WorkspaceWithRole } from "@/repositories/types";

export function AppHeader({
  user,
  workspaces,
  activeWorkspaceId,
  activeRole,
  isPlatformAdmin = false,
}: {
  user: AppUser;
  workspaces: WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
  isPlatformAdmin?: boolean;
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
        <div className="flex items-center gap-0.5">
          <ChannelsMenu />
          <ProductPluginMenu />
          <WalletMenu />
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <FeedbackHeaderMenu />
        <Button
          render={<Link href="/settings/profile" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          className="text-neutral-400"
        >
          <SettingsIcon />
        </Button>
        <UserMenu
          user={user}
          showLabel
          isPlatformAdmin={isPlatformAdmin}
        />
      </div>
    </header>
  );
}
