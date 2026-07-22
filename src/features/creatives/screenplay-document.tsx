import type { ScreenplayPayload, ScreenplayScene } from "@/domain";
import { cn } from "@/lib/utils";

export type ScreenplayFieldKey =
  | "logline"
  | "heading"
  | "action"
  | "character"
  | "dialogue";

export type ScreenplayFieldDiff = {
  sceneId: string | null;
  field: ScreenplayFieldKey;
  before: string;
  after: string;
};

/** Anchored highlight for a single text range inside one field. */
export type ScreenplayTextHighlight = {
  sceneId: string | null;
  field: ScreenplayFieldKey;
  start: number;
  end: number;
};

/** Matches native selection + mark tint (amber-400 @ 35%). */
export const SCREENPLAY_HIGHLIGHT_BG = "rgb(251 191 36 / 0.35)";

/**
 * Final Draft–inspired screenplay layout.
 * Uses US screenplay conventions: Courier, sluglines, action, dialogue column.
 */
export function ScreenplayDocument({
  screenplay,
  className,
  highlight,
  diffs,
}: {
  screenplay: ScreenplayPayload;
  className?: string;
  /** Currently selected / commented range to tint in the sheet. */
  highlight?: ScreenplayTextHighlight | null;
  /** Accepted proposal preview — render before/after for changed fields. */
  diffs?: ScreenplayFieldDiff[];
}) {
  const diffMap = new Map(
    (diffs ?? []).map((d) => [`${d.sceneId ?? "meta"}:${d.field}`, d]),
  );

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[8.5in] border border-white/15 bg-neutral-800 text-neutral-100 shadow-[0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.45)]",
        "[&_*::selection]:bg-[rgb(251_191_36_/_0.35)] [&_*::selection]:text-inherit",
        className,
      )}
      data-screenplay-sheet
    >
      <div className="border-b border-white/10 px-8 py-8 text-center sm:px-[1.5in]">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          Screenplay
        </p>
        <FieldText
          className="mt-3 font-mono text-sm leading-relaxed text-neutral-300"
          sceneId={null}
          field="logline"
          text={screenplay.logline}
          highlight={highlight}
          diff={diffMap.get("meta:logline")}
        />
        <p className="mt-2 font-mono text-[10px] text-neutral-500">
          {screenplay.aspectRatio} · {screenplay.targetDurationSec}s
        </p>
      </div>

      <div className="px-8 py-10 font-mono text-[12.5px] leading-[1.15] sm:px-[1.5in]">
        {screenplay.scenes.map((scene, index) => (
          <SceneBlock
            key={scene.id}
            scene={scene}
            className={cn(index > 0 && "mt-8")}
            highlight={highlight}
            diffs={diffMap}
          />
        ))}
      </div>
    </div>
  );
}

function SceneBlock({
  scene,
  className,
  highlight,
  diffs,
}: {
  scene: ScreenplayScene;
  className?: string;
  highlight?: ScreenplayTextHighlight | null;
  diffs: Map<string, ScreenplayFieldDiff>;
}) {
  const headingDiff = diffs.get(`${scene.id}:heading`);
  const actionDiff = diffs.get(`${scene.id}:action`);
  const characterDiff = diffs.get(`${scene.id}:character`);
  const dialogueDiff = diffs.get(`${scene.id}:dialogue`);

  const characterLabel =
    scene.spokenKind === "dialogue"
      ? scene.character.trim() || "Character"
      : "Voiceover";

  return (
    <section className={className} data-scene-id={scene.id}>
      <h2 className="mb-4 font-bold uppercase tracking-wide">
        <FieldText
          sceneId={scene.id}
          field="heading"
          text={scene.heading}
          highlight={highlight}
          diff={headingDiff}
        />
      </h2>

      {scene.action || actionDiff ? (
        <p className="mb-4 whitespace-pre-wrap">
          <FieldText
            sceneId={scene.id}
            field="action"
            text={scene.action}
            highlight={highlight}
            diff={actionDiff}
          />
        </p>
      ) : null}

      {scene.dialogue || dialogueDiff || characterDiff ? (
        <div className="mx-auto mb-4 w-[70%] max-w-[3.5in] sm:w-[55%]">
          <p className="mb-1 text-center font-bold uppercase">
            <FieldText
              sceneId={scene.id}
              field="character"
              text={characterLabel}
              highlight={highlight}
              diff={characterDiff}
            />
          </p>
          <p className="whitespace-pre-wrap text-center">
            <FieldText
              sceneId={scene.id}
              field="dialogue"
              text={scene.dialogue}
              highlight={highlight}
              diff={dialogueDiff}
            />
          </p>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] text-neutral-500">
        ({scene.durationSec}s)
      </p>
    </section>
  );
}

function FieldText({
  sceneId,
  field,
  text,
  highlight,
  diff,
  className,
}: {
  sceneId: string | null;
  field: ScreenplayFieldKey;
  text: string;
  highlight?: ScreenplayTextHighlight | null;
  diff?: ScreenplayFieldDiff;
  className?: string;
}) {
  const isHighlighted =
    highlight &&
    highlight.field === field &&
    highlight.sceneId === sceneId &&
    highlight.start < highlight.end;

  if (diff && diff.before !== diff.after) {
    return (
      <span
        className={className}
        data-screenplay-field={field}
        data-scene-id={sceneId ?? "meta"}
      >
        {diff.before ? (
          <span className="mr-1 rounded-sm bg-red-500/20 text-red-200 line-through decoration-red-400/80">
            {diff.before}
          </span>
        ) : null}
        {diff.after ? (
          <span className="rounded-sm bg-emerald-500/20 text-emerald-100">
            {diff.after}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={className}
      data-screenplay-field={field}
      data-scene-id={sceneId ?? "meta"}
    >
      {isHighlighted ? renderRangeHighlight(text, highlight) : text}
    </span>
  );
}

function renderRangeHighlight(
  text: string,
  highlight: ScreenplayTextHighlight,
) {
  const start = Math.max(0, Math.min(highlight.start, text.length));
  const end = Math.max(start, Math.min(highlight.end, text.length));
  if (start >= end) return text;

  return (
    <>
      {text.slice(0, start)}
      <mark
        className="rounded-sm text-inherit"
        style={{ backgroundColor: SCREENPLAY_HIGHLIGHT_BG }}
      >
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function diffScreenplays(
  before: ScreenplayPayload,
  after: ScreenplayPayload,
): ScreenplayFieldDiff[] {
  const diffs: ScreenplayFieldDiff[] = [];

  if (before.logline !== after.logline) {
    diffs.push({
      sceneId: null,
      field: "logline",
      before: before.logline,
      after: after.logline,
    });
  }

  const beforeById = new Map(before.scenes.map((s) => [s.id, s]));
  const afterById = new Map(after.scenes.map((s) => [s.id, s]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);

  for (const id of ids) {
    const a = beforeById.get(id);
    const b = afterById.get(id);
    if (!a && b) {
      pushSceneFields(diffs, id, emptyScene(), b);
      continue;
    }
    if (a && !b) {
      pushSceneFields(diffs, id, a, emptyScene());
      continue;
    }
    if (a && b) {
      pushSceneFields(diffs, id, a, b);
    }
  }

  return diffs;
}

function emptyScene(): ScreenplayScene {
  return {
    id: "",
    heading: "",
    action: "",
    dialogue: "",
    spokenKind: "voiceover",
    character: "",
    durationSec: 1,
  };
}

function pushSceneFields(
  diffs: ScreenplayFieldDiff[],
  sceneId: string,
  before: ScreenplayScene,
  after: ScreenplayScene,
) {
  if (before.heading !== after.heading) {
    diffs.push({
      sceneId,
      field: "heading",
      before: before.heading,
      after: after.heading,
    });
  }
  if (before.action !== after.action) {
    diffs.push({
      sceneId,
      field: "action",
      before: before.action,
      after: after.action,
    });
  }
  if (before.dialogue !== after.dialogue) {
    diffs.push({
      sceneId,
      field: "dialogue",
      before: before.dialogue,
      after: after.dialogue,
    });
  }

  const beforeCharacter =
    before.spokenKind === "dialogue"
      ? before.character.trim() || "Character"
      : before.dialogue
        ? "Voiceover"
        : "";
  const afterCharacter =
    after.spokenKind === "dialogue"
      ? after.character.trim() || "Character"
      : after.dialogue
        ? "Voiceover"
        : "";
  if (beforeCharacter !== afterCharacter) {
    diffs.push({
      sceneId,
      field: "character",
      before: beforeCharacter,
      after: afterCharacter,
    });
  }
}
