"use client";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export function validateWorkspaceAvatarFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Avatar must be a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Avatar must be 2MB or smaller.");
  }
}

export async function uploadWorkspaceAvatar(
  workspaceId: string,
  file: File,
): Promise<string> {
  validateWorkspaceAvatarFile(file);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const path = `${workspaceId}/avatar/${crypto.randomUUID().slice(0, 8)}.${extensionFor(file)}`;

  const { error } = await supabase.storage
    .from("workspace-assets")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message || "Failed to upload avatar");
  }

  const { data } = supabase.storage.from("workspace-assets").getPublicUrl(path);
  return data.publicUrl;
}
