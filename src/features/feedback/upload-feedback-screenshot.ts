"use client";

export async function uploadFeedbackScreenshot(
  userId: string,
  blob: Blob,
): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const path = `${userId}/feedback/${crypto.randomUUID()}.png`;

  const { error } = await supabase.storage.from("user-assets").upload(path, blob, {
    cacheControl: "3600",
    contentType: "image/png",
    upsert: false,
  });
  if (error) {
    throw new Error(error.message || "Failed to upload screenshot");
  }

  const { data } = supabase.storage.from("user-assets").getPublicUrl(path);
  return data.publicUrl;
}
