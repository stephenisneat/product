export const CREATIVE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const CREATIVE_VIDEO_MAX_DURATION_SEC = 180;

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const THUMB_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForCreativeVideo(contentType: string): string | null {
  return VIDEO_MIME_TO_EXT[contentType] ?? null;
}

export function extensionForCreativeThumbnail(
  contentType: string,
): string | null {
  return THUMB_MIME_TO_EXT[contentType] ?? null;
}

export function validateCreativeVideoFile(opts: {
  contentType: string;
  sizeBytes: number;
}): string | null {
  if (!extensionForCreativeVideo(opts.contentType)) {
    return "Use an MP4, WebM, or QuickTime video.";
  }
  if (opts.sizeBytes <= 0) {
    return "Video file is empty.";
  }
  if (opts.sizeBytes > CREATIVE_VIDEO_MAX_BYTES) {
    return "Video must be 200 MB or smaller.";
  }
  return null;
}

export function validateCreativeVideoMeta(opts: {
  durationSec: number;
  aspectRatio: string;
}): string | null {
  if (!Number.isFinite(opts.durationSec) || opts.durationSec <= 0) {
    return "Could not read video duration.";
  }
  if (opts.durationSec > CREATIVE_VIDEO_MAX_DURATION_SEC) {
    return `Video must be ${CREATIVE_VIDEO_MAX_DURATION_SEC} seconds or shorter.`;
  }
  if (!opts.aspectRatio.trim()) {
    return "Could not read video aspect ratio.";
  }
  return null;
}
