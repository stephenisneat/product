"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CreatePluginDialog } from "@/features/plugin/create-plugin-dialog";
import {
  platformLabel,
  type PluginInstallPlatform,
} from "@/features/plugin/install-platforms";
import type { PluginListItem } from "@/lib/plugin/types";
import { cn } from "@/lib/utils";

export function PluginList({
  workspaceName,
}: {
  workspaceName: string;
}) {
  const router = useRouter();
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plugin/containers");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to load plugins",
        );
      }
      setPlugins(Array.isArray(data.plugins) ? data.plugins : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function handleCreated(item: PluginListItem) {
    setPlugins((prev) => [...prev, item]);
    router.push(`/settings/plugin/${item.container.id}`);
  }

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Plugins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Install and manage tag containers for {workspaceName}. Each plugin
            has its own snippet and configuration.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          New plugin
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading plugins…</p>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : plugins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No plugins yet. Create one for each site or app you want to
            instrument.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon data-icon="inline-start" />
            New plugin
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {plugins.map((item) => {
            const connected = item.status.has_ever_received;
            return (
              <li key={item.container.id}>
                <Link
                  href={`/settings/plugin/${item.container.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      connected ? "bg-emerald-500" : "bg-red-500",
                    )}
                    aria-label={connected ? "Connected" : "Not connected"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.container.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {platformLabel(
                        item.container.platform as PluginInstallPlatform,
                      )}
                      {item.container.domain
                        ? ` · ${item.container.domain}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    v{item.container.published_version || "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePluginDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
