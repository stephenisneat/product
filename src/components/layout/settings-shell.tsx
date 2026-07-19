"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import type { AppUser } from "@/domain";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { UpgradeProvider } from "@/features/billing/upgrade-context";
import { getSettingsReturnPath } from "@/features/settings/return-path";
import { SettingsNav } from "@/features/settings/settings-nav";

export function SettingsShell({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  const [returnHref, setReturnHref] = useState("/");

  useEffect(() => {
    setReturnHref(getSettingsReturnPath("/"));
  }, []);

  return (
    <UpgradeProvider>
      <div className="flex h-svh w-full overflow-hidden bg-canvas">
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
          <div className="flex h-14 shrink-0 items-center px-4">
            <p className="font-heading text-sm font-medium tracking-tight">
              Settings
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
            <SettingsNav />
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
            <Button
              render={<Link href={returnHref} />}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to app
            </Button>
            <UserMenu user={user} showLabel />
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </UpgradeProvider>
  );
}
