"use client";

import { validateAvatarFile, extensionForAvatar } from "@/lib/avatars/validate";

export async function uploadUserAvatar(
  userId: string,
  file: File,
): Promise<string> {
  validateAvatarFile(file);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const path = `${userId}/avatar/${crypto.randomUUID().slice(0, 8)}.${extensionForAvatar(file)}`;

  const { error } = await supabase.storage
    .from("user-assets")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message || "Failed to upload avatar");
  }

  const { data } = supabase.storage.from("user-assets").getPublicUrl(path);
  return data.publicUrl;
}
