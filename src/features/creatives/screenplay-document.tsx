import type { ScreenplayPayload } from "@/domain";
import { cn } from "@/lib/utils";

/**
 * Final Draft–inspired screenplay layout.
 * Uses US screenplay conventions: Courier, sluglines, action, dialogue column.
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
        className,
      )}
    >
      <div className="border-b border-black/5 px-8 py-8 text-center sm:px-[1.5in]">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45">
          Screenplay
        </p>
        <p className="mt-3 font-mono text-sm leading-relaxed text-black/70">
          {screenplay.logline}
        </p>
        <p className="mt-2 font-mono text-[10px] text-black/40">
          {screenplay.aspectRatio} · {screenplay.targetDurationSec}s
        </p>
      </div>

      <div className="px-8 py-10 font-mono text-[12.5px] leading-[1.15] sm:px-[1.5in]">
        {screenplay.scenes.map((scene, index) => (
          <section
            key={scene.id}
            className={cn(index > 0 && "mt-8")}
          >
            <h2 className="mb-4 font-bold uppercase tracking-wide">
              {scene.heading}
            </h2>

            {scene.action ? (
              <p className="mb-4 whitespace-pre-wrap">{scene.action}</p>
            ) : null}

            {scene.dialogue ? (
              <div className="mx-auto mb-4 w-[70%] max-w-[3.5in] sm:w-[55%]">
                <p className="mb-1 text-center font-bold uppercase">
                  Voiceover
                </p>
                <p className="whitespace-pre-wrap text-center">
                  {scene.dialogue}
                </p>
              </div>
            ) : null}

            <p className="mt-2 text-[10px] text-black/35">
              ({scene.durationSec}s)
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
