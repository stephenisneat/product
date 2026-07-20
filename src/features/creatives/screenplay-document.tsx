import type { ScreenplayPayload } from "@/domain";
import { cn } from "@/lib/utils";

/**
 * Final Draft–inspired screenplay layout.
 * Uses US screenplay conventions: Courier, sluglines, action, dialogue column.
 * Theme-aware so the page remains readable in dark mode.
 */
export function ScreenplayDocument({
  screenplay,
  className,
}: {
  screenplay: ScreenplayPayload;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[8.5in] bg-[#faf9f6] text-[#1a1a1a] shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)]",
        "dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="border-b border-black/5 px-8 py-8 text-center dark:border-white/10 sm:px-[1.5in]">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45 dark:text-zinc-500">
          Screenplay
        </p>
        <p className="mt-3 font-mono text-sm leading-relaxed text-black/70 dark:text-zinc-300">
          {screenplay.logline}
        </p>
        <p className="mt-2 font-mono text-[10px] text-black/40 dark:text-zinc-500">
          {screenplay.aspectRatio} · {screenplay.targetDurationSec}s
        </p>
      </div>

      <div className="px-8 py-10 font-mono text-[12.5px] leading-[1.15] sm:px-[1.5in]">
        {screenplay.scenes.map((scene, index) => (
          <section key={scene.id} className={cn(index > 0 && "mt-8")}>
            <h2 className="mb-4 font-bold uppercase tracking-wide">
              {scene.heading}
            </h2>

            {scene.action ? (
              <p className="mb-4 whitespace-pre-wrap">{scene.action}</p>
            ) : null}

            {scene.dialogue ? (
              <div className="mx-auto mb-4 w-[70%] max-w-[3.5in] sm:w-[55%]">
                <p className="mb-1 text-center font-bold uppercase">
                  {scene.spokenKind === "dialogue"
                    ? scene.character.trim() || "Character"
                    : "Voiceover"}
                </p>
                <p className="whitespace-pre-wrap text-center">
                  {scene.dialogue}
                </p>
              </div>
            ) : null}

            <p className="mt-2 text-[10px] text-black/35 dark:text-zinc-500">
              ({scene.durationSec}s)
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
