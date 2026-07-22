import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { logServerError, unknownErrorMessage } from "@/lib/errors";
import {
  listElevenLabsVoices,
  synthesizeSceneAudio,
} from "@/lib/media/elevenlabs";
import { assertElevenLabsConfigured, hasElevenLabs } from "@/lib/media/env";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  if (!hasElevenLabs()) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured.", voices: [] },
      { status: 503 },
    );
  }

  try {
    assertElevenLabsConfigured();
    const voices = await listElevenLabsVoices();
    return NextResponse.json({
      voices: voices.map((v) => ({
        voiceId: v.voiceId,
        name: v.name ?? v.voiceId,
        description: v.description ?? "",
        labels: v.labels ?? {},
      })),
    });
  } catch (err) {
    logServerError("api.voices.list", err);
    return NextResponse.json(
      { error: unknownErrorMessage(err, "Failed to list voices.") },
      { status: 500 },
    );
  }
}

const previewSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().trim().min(1).max(280).optional(),
  creativeId: z.string().uuid().optional(),
});

/** Short TTS preview for world-stage voice picking. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspace();
  if (!active) {
    return NextResponse.json({ error: "No workspace available" }, { status: 400 });
  }

  if (!hasElevenLabs()) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured." },
      { status: 503 },
    );
  }

  const parsed = previewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    assertElevenLabsConfigured();
    const text =
      parsed.data.text?.trim() ||
      "Hi — this is a quick preview of how I sound in your ad.";
    const creativeId = parsed.data.creativeId ?? "voice-preview";
    const url = await synthesizeSceneAudio({
      text,
      voiceId: parsed.data.voiceId,
      workspaceId: active.workspace.id,
      creativeId,
      sceneId: `preview-${crypto.randomUUID().slice(0, 8)}`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    logServerError("api.voices.preview", err);
    return NextResponse.json(
      { error: unknownErrorMessage(err, "Failed to preview voice.") },
      { status: 500 },
    );
  }
}
