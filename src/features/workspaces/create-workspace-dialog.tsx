"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Workspace } from "@/domain";
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
import { Switch } from "@/components/ui/switch";
import { AvatarCropDialog } from "@/features/avatars/avatar-crop-dialog";
import { useAvatarCropPicker } from "@/features/avatars/use-avatar-crop-picker";
import {
  parsePrimaryDomain,
  parseWorkEmailDomain,
  workEmailDomainFromAddress,
} from "@/lib/workspaces/domain";
import { uploadWorkspaceAvatar } from "@/lib/workspaces/upload-avatar";
import { WorkspaceAvatar } from "@/features/workspaces/workspace-avatar";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const {
    fileInputRef,
    cropSrc,
    cropOpen,
    pickError,
    setPickError,
    openPicker,
    onFileSelected,
    onCropOpenChange,
  } = useAvatarCropPicker();

  const defaultDomain = workEmailDomainFromAddress(userEmail) ?? "";
  const [name, setName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState(defaultDomain);
  const [domainJoinEnabled, setDomainJoinEnabled] = useState(false);
  const [joinDomain, setJoinDomain] = useState(defaultDomain);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPrimaryDomain(defaultDomain);
    setDomainJoinEnabled(false);
    setJoinDomain(defaultDomain);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    setBusy(false);
    onCropOpenChange(false);
    setPickError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onCropped(cropped: File) {
    setError(null);
    setPickError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(cropped);
    setPreviewUrl(URL.createObjectURL(cropped));
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }

    let normalizedPrimary: string | null = null;
    if (primaryDomain.trim()) {
      try {
        normalizedPrimary = parsePrimaryDomain(primaryDomain);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid primary domain");
        return;
      }
    }

    let normalizedJoinDomain: string | null = null;
    if (domainJoinEnabled) {
      try {
        normalizedJoinDomain = parseWorkEmailDomain(joinDomain);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid work domain");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          primaryDomain: normalizedPrimary,
          domainJoinEnabled,
          joinDomain: normalizedJoinDomain,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        workspace?: Workspace;
      };
      if (!res.ok || !body.workspace) {
        throw new Error(body.error || "Failed to create workspace");
      }

      let workspace = body.workspace;

      if (file) {
        const avatarUrl = await uploadWorkspaceAvatar(workspace.id, file);
        const patchRes = await fetch(`/api/workspaces/${workspace.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl }),
        });
        const patchBody = (await patchRes.json().catch(() => ({}))) as {
          error?: string;
          workspace?: Workspace;
        };
        if (!patchRes.ok) {
          throw new Error(
            patchBody.error || "Workspace created, but avatar upload failed",
          );
        }
        if (patchBody.workspace) workspace = patchBody.workspace;
      }

      handleOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create workspace",
      );
    } finally {
      setBusy(false);
    }
  }

  const displayError = error ?? pickError;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep products, members, and billing separate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <WorkspaceAvatar
                name={name || "W"}
                avatarUrl={previewUrl}
                size="default"
                className="size-10"
              />
              <div className="space-y-1.5">
                <Label htmlFor={fileInputId}>Avatar</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => openPicker()}
                  >
                    Upload
                  </Button>
                  {file ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={clearFile}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    onFileSelected(selected);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme"
                disabled={busy}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="primary-domain">Primary domain</Label>
              <Input
                id="primary-domain"
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                placeholder="company.com"
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Used by the plugin and related features.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="domain-join">Domain join</Label>
                  <p className="text-xs text-muted-foreground">
                    People with a matching company email can discover and join.
                    Personal providers like Gmail, Proton Mail, and Yahoo are
                    not allowed.
                  </p>
                </div>
                <Switch
                  id="domain-join"
                  checked={domainJoinEnabled}
                  disabled={busy}
                  onCheckedChange={(checked) => {
                    setDomainJoinEnabled(checked);
                    if (checked && !joinDomain) setJoinDomain(defaultDomain);
                  }}
                />
              </div>
              {domainJoinEnabled ? (
                <div className="space-y-1.5">
                  <Label htmlFor="join-domain">Email domain</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@</span>
                    <Input
                      id="join-domain"
                      value={joinDomain}
                      onChange={(e) => setJoinDomain(e.target.value)}
                      placeholder="company.com"
                      disabled={busy}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {displayError ? (
              <p className="text-sm text-destructive">{displayError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void submit()}
            >
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        shape="rect"
        onOpenChange={onCropOpenChange}
        onCropped={onCropped}
      />
    </>
  );
}
