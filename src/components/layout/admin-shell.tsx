"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/features/admin/admin-nav";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh w-full overflow-hidden bg-black">
      <aside className="flex w-56 shrink-0 flex-col bg-black">
        <div className="flex h-14 shrink-0 items-center px-3">
          <Button
            render={<Link href="/" />}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back to app
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <AdminNav />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 pt-3 pr-3 pb-3">
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-canvas">
          {children}
        </main>
      </div>
    </div>
  );
}
