"use client";

import { Loader2 } from "@/components/icons";
import { useEffect, useState, useTransition } from "react";
import type { Creative } from "@/domain";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type VoiceOption = {
  voiceId: string;
  name: string;
  description: string;
};

function SheetCard({
  title,
  subtitle,
  imageUrl,
  className,
}: {
  title: string;
  subtitle?: string;
  imageUrl: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card/40",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={title}
        className="aspect-video w-full object-cover"
      />
      <figcaption className="space-y-1 p-2.5">
        <p className="text-xs font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}

function VoicePicker({
  label,
  value,
  voices,
  disabled,
  onChange,
  onPreview,
  previewing,
}: {
  label: string;
  value: string;
  voices: VoiceOption[];
  disabled?: boolean;
  onChange: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
  previewing?: boolean;
}) {
  const selected = voices.find((v) => v.voiceId === value);
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled || previewing || !value}
          onClick={() => onPreview(value)}
        >
          {previewing ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Previewing
            </>
          ) : (
            "Preview"
          )}
        </Button>
      </div>
      {voices.length > 0 ? (
        <Select
          value={value}
          onValueChange={(next) => {
            if (typeof next === "string" && next) onChange(next);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a voice">
              {selected?.name ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {voices.map((voice) => (
              <SelectItem key={voice.voiceId} value={voice.voiceId}>
                {voice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">
          {selected?.name ?? value}
        </p>
      )}
    </div>
  );
}

export function WorldView({
  creative,
  onCreativeChange,
}: {
  creative: Creative;
  onCreativeChange?: (creative: Creative) => void;
}) {
  const world = creative.world;
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/voices");
        if (!res.ok) return;
        const data = (await res.json()) as { voices?: VoiceOption[] };
        if (!cancelled) setVoices(data.voices ?? []);
      } catch {
        // Voice library is optional for viewing sheets.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
        {creative.stage === "world" && creative.status === "generating" ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Generating world…
          </>
        ) : creative.stage === "world" && creative.status === "paused" ? (
          <>Generation paused. Resume to continue world.</>
        ) : (
          <>No world yet.</>
        )}
      </div>
    );
  }

  const canEditVoices =
    creative.stage === "world" &&
    (creative.status === "awaiting_review" || creative.status === "revising");

  function patchVoices(patch: {
    voiceoverId?: string;
    characterVoices?: Record<string, string>;
  }) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/creatives/${creative.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_world_voices",
            ...patch,
          }),
        });
        const data = (await res.json()) as {
          creative?: Creative;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to update voices.");
          return;
        }
        if (data.creative) onCreativeChange?.(data.creative);
      } catch {
        setError("Failed to update voices.");
      }
    });
  }

  async function previewVoice(voiceId: string) {
    setPreviewingId(voiceId);
    setError(null);
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId,
          creativeId: creative.id,
          text: "Hi — this is a quick preview of how I sound in your ad.",
        }),
      });
      const data = (await res.json()) as { url?: string | null; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to preview voice.");
        return;
      }
      const audio = new Audio(data.url);
      await audio.play();
    } catch {
      setError("Failed to preview voice.");
    } finally {
      setPreviewingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Style</h2>
        <p className="text-sm text-muted-foreground">{world.styleBible}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SheetCard
            title="Style lock"
            subtitle={world.continuityNotes || undefined}
            imageUrl={world.styleLockUrl}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Product & brand</h2>
        <p className="text-sm text-muted-foreground">
          {world.productAppearance}
          {world.brandLock ? ` · Brand: ${world.brandLock}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {world.productLockUrls.map((url) => (
            <SheetCard
              key={url}
              title="Product lock"
              subtitle={world.brandLock}
              imageUrl={url}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Cast</h2>
        {world.characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Voiceover-only — no on-camera characters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {world.characters.map((character) => (
              <SheetCard
                key={character.name}
                title={character.name}
                subtitle={character.appearanceSummary}
                imageUrl={character.sheetUrl}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Locations</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {world.locations.map((location) => (
            <SheetCard
              key={location.id}
              title={location.name}
              subtitle={`${location.interiorExterior}${location.timeOfDay ? ` · ${location.timeOfDay}` : ""} — ${location.description}`}
              imageUrl={location.sheetUrl}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Voices</h2>
        <p className="text-xs text-muted-foreground">
          Assigned for the video stage. Swap before accepting world.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <VoicePicker
            label="Narrator / voiceover"
            value={world.voiceCast.voiceoverId}
            voices={voices}
            disabled={!canEditVoices || pending}
            onChange={(voiceoverId) => patchVoices({ voiceoverId })}
            onPreview={previewVoice}
            previewing={previewingId === world.voiceCast.voiceoverId}
          />
          {world.characters.map((character) => (
            <VoicePicker
              key={character.name}
              label={`${character.name} dialogue`}
              value={
                world.voiceCast.characterVoices[character.name] ??
                character.voiceId
              }
              voices={voices}
              disabled={!canEditVoices || pending}
              onChange={(voiceId) =>
                patchVoices({
                  characterVoices: { [character.name]: voiceId },
                })
              }
              onPreview={previewVoice}
              previewing={
                previewingId ===
                (world.voiceCast.characterVoices[character.name] ??
                  character.voiceId)
              }
            />
          ))}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </section>
    </div>
  );
}
