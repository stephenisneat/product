"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AvatarCropDialog } from "@/features/avatars/avatar-crop-dialog";
import { useAvatarCropPicker } from "@/features/avatars/use-avatar-crop-picker";
import { uploadUserAvatar } from "@/lib/avatars/upload-user-avatar";

function initialsFor(name: string, email: string) {
  const source = (name.trim() || email).trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

export function ChangeAvatarForm({
  userId,
  currentName,
  currentEmail,
  currentAvatarUrl,
}: {
  userId: string;
  currentName: string;
  currentEmail: string;
  currentAvatarUrl?: string | null;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function persistAvatarUrl(nextUrl: string | null) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be signed in to update your avatar.");
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: nextUrl ?? "" },
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: nextUrl })
      .eq("id", user.id);
    if (profileError) throw new Error(profileError.message);
  }

  async function onCropped(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setPickError(null);
    try {
      const nextUrl = await uploadUserAvatar(userId, file);
      await persistAvatarUrl(nextUrl);
      setAvatarUrl(nextUrl);
      setMessage("Avatar updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setBusy(false);
    }
  }

  async function clearAvatar() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistAvatarUrl(null);
      setAvatarUrl(null);
      setMessage("Avatar removed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setBusy(false);
    }
  }

  const displayError = error ?? pickError;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="default" className="size-14">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>
            {initialsFor(currentName, currentEmail)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => openPicker()}
          >
            Upload
          </Button>
          {avatarUrl ? (
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
              onFileSelected(file);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, or GIF up to 2MB. You’ll crop before saving.
      </p>
      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        shape="round"
        onOpenChange={onCropOpenChange}
        onCropped={onCropped}
      />
    </div>
  );
}
