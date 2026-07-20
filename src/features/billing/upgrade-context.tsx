"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { Workspace, WorkspaceRole } from "@/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BillingPanel = dynamic(
  () =>
    import("@/features/billing/billing-panel").then((m) => m.BillingPanel),
  { ssr: false },
);

type BillingContextPayload = {
  workspace: Workspace;
  role: WorkspaceRole;
  memberCount: number;
};

type UpgradeContextValue = {
  open: boolean;
  openUpgrade: () => void;
  setOpenUpgrade: (open: boolean) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BillingContextPayload | null>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/context");
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        workspace?: Workspace;
        role?: WorkspaceRole;
        memberCount?: number;
      };
      if (!res.ok || !data.workspace || !data.role) {
        throw new Error(data.error || "Failed to load billing");
      }
      setPayload({
        workspace: data.workspace,
        role: data.role,
        memberCount: data.memberCount ?? 1,
      });
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  const openUpgrade = useCallback(() => {
    setOpen(true);
    void loadContext();
  }, [loadContext]);

  const setOpenUpgrade = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) void loadContext();
      if (!next) {
        setError(null);
      }
    },
    [loadContext],
  );

  const value = useMemo(
    () => ({ open, openUpgrade, setOpenUpgrade }),
    [open, openUpgrade, setOpenUpgrade],
  );

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpenUpgrade}>
        <DialogContent className="max-h-[min(92vh,900px)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Upgrade your workspace</DialogTitle>
            <DialogDescription>
              Choose a plan with included AI usage, campaigns, and Insights.
            </DialogDescription>
          </DialogHeader>
          {loading && !payload ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading plans…
            </p>
          ) : error && !payload ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : payload ? (
            <BillingPanel
              workspace={payload.workspace}
              role={payload.role}
              memberCount={payload.memberCount}
              compact
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) {
    throw new Error("useUpgrade must be used within UpgradeProvider");
  }
  return ctx;
}

/** Safe outside the provider (no-ops). */
export function useUpgradeOptional() {
  return useContext(UpgradeContext);
}
