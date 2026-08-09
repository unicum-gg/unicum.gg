import Image from "next/image";
import {
  achievementFace,
  unwrapWgText,
  type PlayerAchievement,
} from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * One medal tile. Earned medals show their artwork at full strength with the
 * count (or the tier reached) badged on the corner; unearned ones are drained
 * of colour so the cabinet reads at a glance without hiding what is left.
 */
export function Medal({ achievement }: { achievement: PlayerAchievement }) {
  const face = achievementFace(achievement);
  const earned = achievement.count > 0;
  const description = unwrapWgText(achievement.description);
  const condition = unwrapWgText(achievement.condition);
  // `marksOnGun` is the one catalogue entry whose art ships with the game client
  // rather than the API, so it has no URL at any tier. Fall back to a lettered
  // tile instead of a broken image.
  const initials = face.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          // Focusable so the tooltip — which carries the name and the earning
          // condition, i.e. everything the tile itself does not say — is
          // reachable without a mouse. Radix opens it on focus as well as hover.
          tabIndex={0}
          role="img"
          aria-label={
            earned
              ? `${face.name}, earned ${achievement.count}×`
              : `${face.name}, not earned`
          }
          className={cn(
            "relative flex size-16 items-center justify-center transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-20",
            // Drained but still legible: an unearned medal has to read as a
            // target, and at 25% the artwork was too faint to recognise which
            // one it was.
            earned ? "opacity-100" : "opacity-45 grayscale hover:opacity-70",
          )}
        >
          {face.image ? (
            <Image
              src={face.image}
              alt={face.name}
              width={80}
              height={80}
              className="size-full object-contain"
            />
          ) : (
            <span className="flex size-full items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground">
              {initials || "?"}
            </span>
          )}
          {/* Untiered medals badge how many times it was earned (and only when
              that is more than once — "×1" is noise). Tiered ones badge nothing:
              the tier is already what the artwork shows. */}
          {earned && face.tierName === null && achievement.count > 1 && (
            <span className="absolute right-0 bottom-0 rounded-sm bg-background/90 px-1 text-[10px] font-semibold tabular-nums">
              {intFmt.format(achievement.count)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      {/* The primitive is built for one-line tooltips: `inline-flex
          items-center gap-1.5` lays children out in a ROW, which turned this
          into three columns with the title squeezed onto two lines. Stack them
          instead, and widen past the base `max-w-xs` — this is a couple of
          sentences plus a bullet list, not a keyboard hint. */}
      <TooltipContent
        side="bottom"
        className="max-w-96 flex-col items-start gap-2 text-left"
      >
        <div className="flex w-full items-baseline justify-between gap-3">
          <span className="font-semibold">{face.name}</span>
          <span className="shrink-0 text-xs opacity-70">
            {earned
              ? (face.tierName ?? `${intFmt.format(achievement.count)}×`)
              : "Not earned"}
          </span>
        </div>

        {description.length > 0 && (
          <div className="space-y-0.5">
            {description.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {/* The condition matters most on a medal the player has NOT earned: it
            is the "how do I get this" the greyed-out tile invites. Rendered as
            a real list, with WG's own bullet glyph stripped so the marker is
            ours and the text aligns under itself instead of hanging. */}
        {condition.length > 0 && (
          <ul className="list-outside list-disc space-y-0.5 pl-4 opacity-70">
            {condition.map((line, i) => (
              <li key={i}>{line.replace(/^[•\-]\s*/, "")}</li>
            ))}
          </ul>
        )}

        {achievement.outdated && (
          <p className="italic opacity-70">No longer obtainable.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
