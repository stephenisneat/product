"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { Workspace, WorkspacePlan, WorkspaceRole } from "@/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WorkspaceAvatar } from "@/features/workspaces/workspace-avatar";
import { UpgradeButton } from "@/features/billing/upgrade-button";
import { planDisplayName } from "@/lib/billing/entitlements";
import {
  parsePrimaryDomain,
  parseWorkEmailDomain,
  workEmailDomainFromAddress,
} from "@/lib/workspaces/domain";
import {
  uploadWorkspaceAvatar,
  validateWorkspaceAvatarFile,
} from "@/lib/workspaces/upload-avatar";

export function WorkspaceProfilePanel({
  workspace: initialWorkspace,
  role,
  currentUserEmail,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
  currentUserEmail: string;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canRename = role === "owner" || role === "admin";
  const canManage = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [name, setName] = useState(initialWorkspace.name);
  const [primaryDomain, setPrimaryDomain] = useState(
    initialWorkspace.primaryDomain ?? "",
  );
  const [plan, setPlan] = useState<WorkspacePlan>(
    initialWorkspace.plan ?? "free",
  );
  const [domainJoinEnabled, setDomainJoinEnabled] = useState(
    initialWorkspace.domainJoinEnabled,
  );
  const [joinDomain, setJoinDomain] = useState(
    initialWorkspace.joinDomain ??
      workEmailDomainFromAddress(currentUserEmail) ??
      "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchWorkspace(
    body: Record<string, unknown>,
    success?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        workspace?: Workspace;
      };
      if (!res.ok) throw new Error(data.error || "Failed to update workspace");
      if (data.workspace) {
        setWorkspace(data.workspace);
        setName(data.workspace.name);
        setPrimaryDomain(data.workspace.primaryDomain ?? "");
        setPlan(data.workspace.plan ?? "free");
        setDomainJoinEnabled(data.workspace.domainJoinEnabled);
        setJoinDomain(
          data.workspace.joinDomain ??
            workEmailDomainFromAddress(currentUserEmail) ??
            "",
        );
      }
      if (success) setMessage(success);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (!canRename) return;
    await patchWorkspace({ name }, "Workspace name updated.");
  }

  async function savePrimaryDomain() {
    if (!canManage) return;
    let normalized: string | null = null;
    if (primaryDomain.trim()) {
      try {
        normalized = parsePrimaryDomain(primaryDomain);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid primary domain");
        setMessage(null);
        return;
      }
    }
    await patchWorkspace(
      { primaryDomain: normalized },
      "Primary domain updated.",
    );
  }

  async function saveDomainJoin() {
    if (!isOwner) return;
    let normalizedDomain: string | null = null;
    if (domainJoinEnabled || joinDomain.trim()) {
      try {
        normalizedDomain = parseWorkEmailDomain(joinDomain);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid work domain");
        setMessage(null);
        return;
      }
    }
    await patchWorkspace(
      {
        domainJoinEnabled: domainJoinEnabled && Boolean(normalizedDomain),
        joinDomain: normalizedDomain,
      },
      "Domain join settings updated.",
    );
  }

  async function onAvatarSelected(file: File | null) {
    if (!canManage || !file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      validateWorkspaceAvatarFile(file);
      const avatarUrl = await uploadWorkspaceAvatar(workspace.id, file);
      setBusy(false);
      await patchWorkspace({ avatarUrl }, "Avatar updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
      setBusy(false);
    }
  }

  async function clearAvatar() {
    if (!canManage) return;
    await patchWorkspace({ clearAvatar: true }, "Avatar removed.");
  }

  return (
    <div className="space-y-10">
      {message ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Avatar</h2>
        <div className="flex flex-wrap items-center gap-4">
          <WorkspaceAvatar
            name={workspace.name}
            avatarUrl={workspace.avatarUrl}
            size="default"
            className="size-14"
          />
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </Button>
              {workspace.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void clearAvatar()}
                >
                  Remove
                </Button>
              ) : null}
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void onAvatarSelected(file);
                }}
              />
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Without a custom avatar, the primary domain favicon is used when set.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Workspace name</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canRename || busy}
            className="max-w-sm"
            aria-label="Workspace name"
          />
          {canRename ? (
            <Button
              type="button"
              onClick={() => void saveName()}
              disabled={busy || name.trim() === workspace.name}
            >
              Save
            </Button>
          ) : null}
        </div>
        {!canRename ? (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can rename this workspace.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Primary domain</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={primaryDomain}
            onChange={(e) => setPrimaryDomain(e.target.value)}
            disabled={!canManage || busy}
            className="max-w-sm"
            placeholder="company.com"
            aria-label="Primary domain"
          />
          {canManage ? (
            <Button
              type="button"
              onClick={() => void savePrimaryDomain()}
              disabled={
                busy ||
                (primaryDomain.trim() || null) ===
                  (workspace.primaryDomain ?? null)
              }
            >
              Save
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Your brand or site domain. Used by the plugin and related features.
        </p>
      </section>

      {isOwner ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Plan</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-foreground">{planDisplayName(plan)}</p>
            <UpgradeButton type="button" size="sm" variant="outline">
              {plan === "pro" ? "Manage plan" : "Upgrade"}
            </UpgradeButton>
          </div>
          <p className="text-xs text-muted-foreground">
            Open plans to upgrade or manage your subscription.
          </p>
        </section>
      ) : null}

      {isOwner ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Domain join</h2>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="settings-domain-join">
                  Allow matching work emails to join
                </Label>
                <p className="text-xs text-muted-foreground">
                  Teammates with this company email domain can discover and join
                  from the workspace picker. Personal providers (Gmail, Proton
                  Mail, Yahoo, Outlook.com, etc.) are not allowed.
                </p>
              </div>
              <Switch
                id="settings-domain-join"
                checked={domainJoinEnabled}
                disabled={busy}
                onCheckedChange={setDomainJoinEnabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-join-domain">Email domain</Label>
              <div className="flex max-w-sm items-center gap-2">
                <span className="text-sm text-muted-foreground">@</span>
                <Input
                  id="settings-join-domain"
                  value={joinDomain}
                  onChange={(e) => setJoinDomain(e.target.value)}
                  placeholder="company.com"
                  disabled={busy}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={
                busy ||
                (domainJoinEnabled === workspace.domainJoinEnabled &&
                  (joinDomain.trim() || null) === (workspace.joinDomain ?? null))
              }
              onClick={() => void saveDomainJoin()}
            >
              Save domain settings
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
