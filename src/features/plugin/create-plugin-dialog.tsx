"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isPluginInstallPlatform,
  PLUGIN_INSTALL_PLATFORMS,
  type PluginInstallPlatform,
} from "@/features/plugin/install-platforms";
import type { PluginListItem } from "@/lib/plugin/types";

export function CreatePluginDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (item: PluginListItem) => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<PluginInstallPlatform>("custom");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPlatform("custom");
    setDomain("");
    setError(null);
    setBusy(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plugin/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          platform,
          domain: domain.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Couldn't create plugin",
        );
      }
      toast.success("Plugin created");
      onCreated?.(data as PluginListItem);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create plugin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New plugin</DialogTitle>
          <DialogDescription>
            Each plugin gets its own install snippet and tag container — for
            example one for your site and another for your store.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="plugin-name">Name</Label>
            <Input
              id="plugin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shopify store"
              autoFocus
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(value) => {
                if (!value || !isPluginInstallPlatform(value)) return;
                setPlatform(value);
              }}
              disabled={busy}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLUGIN_INSTALL_PLATFORMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plugin-domain">Domain (optional)</Label>
            <Input
              id="plugin-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="store.example.com"
              disabled={busy}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create plugin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
