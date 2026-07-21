import type { Creative, VideoPayload, WorkspacePlan } from "@/domain";
import {
  assertCanLinkCreativesToCampaigns,
  normalizeCampaignIds,
  resolveProductCampaignIds,
} from "@/lib/campaigns/associate";
import {
  extensionForCreativeThumbnail,
  extensionForCreativeVideo,
  validateCreativeVideoMeta,
} from "@/lib/media/creative-upload-shared";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { getCreativeWriteRepository } from "@/repositories";

export type SignedUploadTarget = {
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

function shortId() {
  return crypto.randomUUID().slice(0, 8);
}

async function createSignedUpload(
  path: string,
): Promise<SignedUploadTarget> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("workspace-assets")
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message || "Failed to create upload URL");
  }
  const { data: publicData } = supabase.storage
    .from("workspace-assets")
    .getPublicUrl(path);
  return {
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
  };
}

/** Issue signed upload targets under a new (or provided) creative id. */
export async function prepareCreativeVideoUploads(opts: {
  workspaceId: string;
  creativeId?: string;
  videoContentType: string;
  thumbnailContentType: string;
}): Promise<{
  creativeId: string;
  video: SignedUploadTarget;
  thumbnail: SignedUploadTarget;
}> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to upload creatives.",
    );
  }

  const videoExt = extensionForCreativeVideo(opts.videoContentType);
  const thumbExt = extensionForCreativeThumbnail(opts.thumbnailContentType);
  if (!videoExt || !thumbExt) {
    throw new Error("Unsupported media type for creative upload.");
  }

  const creativeId = opts.creativeId ?? crypto.randomUUID();
  const base = `${opts.workspaceId}/creatives/${creativeId}/final`;
  const [video, thumbnail] = await Promise.all([
    createSignedUpload(`${base}/ad-${shortId()}.${videoExt}`),
    createSignedUpload(`${base}/thumb-${shortId()}.${thumbExt}`),
  ]);

  return { creativeId, video, thumbnail };
}

function assertOwnedCreativePath(
  workspaceId: string,
  creativeId: string,
  path: string,
): void {
  const prefix = `${workspaceId}/creatives/${creativeId}/final/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    throw new Error("Invalid creative asset path.");
  }
}

async function assertObjectExists(path: string): Promise<void> {
  const supabase = createServiceClient();
  const parts = path.split("/");
  const filename = parts.pop();
  const folder = parts.join("/");
  if (!filename || !folder) {
    throw new Error("Invalid creative asset path.");
  }
  const { data, error } = await supabase.storage
    .from("workspace-assets")
    .list(folder, { search: filename, limit: 100 });
  if (error) {
    throw new Error(error.message || "Failed to verify uploaded asset.");
  }
  if (!data?.some((obj) => obj.name === filename)) {
    throw new Error("Uploaded asset is missing. Please try again.");
  }
}

/** Create a ready video_ad creative from user-uploaded media. */
export async function createUploadedVideoCreative(opts: {
  workspaceId: string;
  productId: string;
  campaignIds?: string[];
  campaignId?: string | null;
  title: string;
  brief?: string;
  createdBy: string;
  plan: WorkspacePlan;
  creativeId: string;
  videoPath: string;
  thumbnailPath: string;
  durationSec: number;
  aspectRatio: string;
  productTitle?: string;
}): Promise<Creative> {
  if (!hasServiceRole()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to upload creatives.",
    );
  }

  assertOwnedCreativePath(opts.workspaceId, opts.creativeId, opts.videoPath);
  assertOwnedCreativePath(
    opts.workspaceId,
    opts.creativeId,
    opts.thumbnailPath,
  );

  const metaError = validateCreativeVideoMeta({
    durationSec: opts.durationSec,
    aspectRatio: opts.aspectRatio,
  });
  if (metaError) throw new Error(metaError);

  const supabase = createServiceClient();
  const videoPublic = supabase.storage
    .from("workspace-assets")
    .getPublicUrl(opts.videoPath).data.publicUrl;
  const thumbPublic = supabase.storage
    .from("workspace-assets")
    .getPublicUrl(opts.thumbnailPath).data.publicUrl;

  await Promise.all([
    assertObjectExists(opts.videoPath),
    assertObjectExists(opts.thumbnailPath),
  ]);

  const creatives = getCreativeWriteRepository();
  const campaignIds = await resolveProductCampaignIds(
    opts.productId,
    normalizeCampaignIds({
      campaignIds: opts.campaignIds,
      campaignId: opts.campaignId,
    }),
  );

  await assertCanLinkCreativesToCampaigns({
    plan: opts.plan,
    campaignIds,
    countByCampaign: (id) => creatives.countByCampaign(id),
  });

  const existing = await creatives.getById(opts.creativeId);
  if (existing) {
    throw new Error("Creative already exists.");
  }

  const video: VideoPayload = {
    url: videoPublic,
    thumbnailUrl: thumbPublic,
    durationSec: opts.durationSec,
    aspectRatio: opts.aspectRatio,
    clips: [],
    productTitle: opts.productTitle,
  };

  const creative = await creatives.create({
    id: opts.creativeId,
    workspaceId: opts.workspaceId,
    productId: opts.productId,
    campaignIds,
    title: opts.title,
    brief: opts.brief?.trim() || "Uploaded video ad",
    stage: "video",
    status: "ready",
    createdBy: opts.createdBy,
  });

  return creatives.update(creative.id, { video });
}

export {
  CREATIVE_VIDEO_MAX_BYTES,
  CREATIVE_VIDEO_MAX_DURATION_SEC,
  extensionForCreativeThumbnail,
  extensionForCreativeVideo,
  validateCreativeVideoFile,
  validateCreativeVideoMeta,
} from "@/lib/media/creative-upload-shared";
