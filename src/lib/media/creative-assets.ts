import { createServiceClient } from "@/lib/supabase/service";

async function uploadBytes(opts: {
  workspaceId: string;
  creativeId: string;
  folder: string;
  filename: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const path = `${opts.workspaceId}/creatives/${opts.creativeId}/${opts.folder}/${opts.filename}`;
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from("workspace-assets")
    .upload(path, opts.bytes, {
      cacheControl: "3600",
      contentType: opts.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message || `Failed to upload ${opts.folder} asset`);
  }
  const { data } = supabase.storage.from("workspace-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadCreativeAudio(opts: {
  workspaceId: string;
  creativeId: string;
  sceneId: string;
  bytes: Uint8Array;
}): Promise<string> {
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "audio",
    filename: `${opts.sceneId}-${crypto.randomUUID().slice(0, 8)}.mp3`,
    bytes: opts.bytes,
    contentType: "audio/mpeg",
  });
}

export async function uploadCreativeVideoClip(opts: {
  workspaceId: string;
  creativeId: string;
  sceneId: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const ext = opts.contentType?.includes("webm") ? "webm" : "mp4";
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "clips",
    filename: `${opts.sceneId}-${crypto.randomUUID().slice(0, 8)}.${ext}`,
    bytes: opts.bytes,
    contentType: opts.contentType || "video/mp4",
  });
}

export async function uploadCreativeFinalVideo(opts: {
  workspaceId: string;
  creativeId: string;
  bytes: Uint8Array;
}): Promise<string> {
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "final",
    filename: `ad-${crypto.randomUUID().slice(0, 8)}.mp4`,
    bytes: opts.bytes,
    contentType: "video/mp4",
  });
}

export async function uploadCreativeThumbnail(opts: {
  workspaceId: string;
  creativeId: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const ext = opts.contentType?.includes("jpeg")
    ? "jpg"
    : opts.contentType?.includes("webp")
      ? "webp"
      : "png";
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "final",
    filename: `thumb-${crypto.randomUUID().slice(0, 8)}.${ext}`,
    bytes: opts.bytes,
    contentType: opts.contentType || "image/png",
  });
}

export async function uploadDisplayCreativeImage(opts: {
  workspaceId: string;
  creativeId: string;
  variant: "marketing" | "square";
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const ext = opts.contentType?.includes("jpeg")
    ? "jpg"
    : opts.contentType?.includes("webp")
      ? "webp"
      : "png";
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "display",
    filename: `${opts.variant}-${crypto.randomUUID().slice(0, 8)}.${ext}`,
    bytes: opts.bytes,
    contentType: opts.contentType || "image/png",
  });
}

/** Style / cast / location / product lock sheets for the world stage. */
export async function uploadCreativeWorldSheet(opts: {
  workspaceId: string;
  creativeId: string;
  kind: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const ext = opts.contentType?.includes("jpeg")
    ? "jpg"
    : opts.contentType?.includes("webp")
      ? "webp"
      : "png";
  const safeKind = opts.kind.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
  return uploadBytes({
    workspaceId: opts.workspaceId,
    creativeId: opts.creativeId,
    folder: "world",
    filename: `${safeKind}-${crypto.randomUUID().slice(0, 8)}.${ext}`,
    bytes: opts.bytes,
    contentType: opts.contentType || "image/png",
  });
}

export async function downloadUrlToBytes(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string | null;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download asset (${res.status}): ${url}`);
  }
  const buffer = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    contentType: res.headers.get("content-type"),
  };
}

export async function readableStreamToUint8Array(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
