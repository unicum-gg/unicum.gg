import type { PodiumSupporter } from "@/app/api/support/podium/schema.api";
import { cn } from "@/lib/utils";

/**
 * The three metals, in the tints the site already draws a Mark of Mastery in
 * (`components/tanks/mom-colors`), so the gold on this board and the gold on a
 * profile are the same gold. Kept as a map of its own rather than read off that
 * one: the mastery ladder is a four-rung scale with its own meaning, and tying
 * a podium step to "Ace" would make neither retintable alone.
 *
 * `face` is the medal, `ink` the step it stands on. They differ for silver
 * alone, and only because the step is drawn as a wash of its metal: silver is
 * light enough that a wash of it is invisible on a light background, which left
 * the second place looking less earned than the bronze beside it. The medal
 * keeps the bright tint, since it is a filled disc rather than a wash.
 */
const METAL: Record<number, { face: string; ink: string }> = {
  1: { face: "#FFBA00", ink: "#FFBA00" },
  2: { face: "#C4C9D1", ink: "#8E97A5" },
  3: { face: "#D68C4E", ink: "#D68C4E" },
};

/**
 * What separates a podium from three cards in a row: the first place stands on
 * a taller step, wears a bigger medal and sits in the middle, with the second
 * on its left and the third on its right.
 */
const STEP: Record<
  number,
  { height: string; medal: string; engraved: string; order: string }
> = {
  1: { height: "7rem", medal: "size-16 text-2xl", engraved: "text-4xl", order: "order-2" },
  2: { height: "5rem", medal: "size-12 text-lg", engraved: "text-3xl", order: "order-1" },
  3: { height: "3.5rem", medal: "size-12 text-lg", engraved: "text-2xl", order: "order-3" },
};

const mix = (color: string, percent: number, into = "transparent") =>
  `color-mix(in srgb, ${color} ${percent}%, ${into})`;

function Crown({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 14" className="h-3.5 w-6" fill={color} aria-hidden>
      <path d="M1.2 12.4 0 2.6l6 3.6L12 0l6 6.2 6-3.6-1.2 9.8H1.2Z" />
    </svg>
  );
}

/**
 * One place on the podium. A `supporter` of `null` is a seat nobody holds yet,
 * drawn as a dashed outline rather than dropped: the podium keeps its shape
 * while the board fills up, and an empty step reads as one still to be taken.
 * It is hidden from assistive technology, since there is nothing there to
 * announce.
 */
function Place({
  rank,
  supporter,
}: {
  rank: number;
  supporter: PodiumSupporter | null;
}) {
  const { face, ink } = METAL[rank];
  const { height, medal, engraved, order } = STEP[rank];
  const ghost = !supporter;

  return (
    <li
      className={cn("flex w-full max-w-[11rem] flex-1 flex-col items-center", order)}
      aria-hidden={ghost || undefined}
    >
      <div className="h-3.5">{rank === 1 && !ghost && <Crown color={face} />}</div>
      <span
        className={cn(
          "mt-1 flex items-center justify-center rounded-full font-heading font-bold tabular-nums",
          medal,
          ghost && "border border-dashed border-fd-border text-fd-muted-foreground/50",
        )}
        style={
          ghost
            ? undefined
            : {
                background: `linear-gradient(150deg, ${mix(face, 55, "white")} 0%, ${face} 48%, ${mix(face, 72, "black")} 100%)`,
                color: "rgba(0,0,0,0.7)",
                boxShadow: `0 0 0 1px ${mix(face, 45)}, 0 10px 22px -12px ${mix(face, 90)}`,
              }
        }
      >
        {rank}
      </span>
      <span
        className={cn(
          "mt-2 w-full truncate px-1 text-center text-xs font-semibold sm:text-sm",
          ghost && "text-fd-muted-foreground/50",
          supporter?.anonymous && "font-normal italic opacity-70",
        )}
        title={supporter?.name}
      >
        {supporter?.name ?? "—"}
      </span>
      <div
        className={cn(
          "relative mt-3 flex w-full items-center justify-center rounded-t-md border-x border-t",
          ghost && "border-dashed border-fd-border",
        )}
        style={{
          height,
          ...(ghost
            ? {}
            : {
                borderColor: mix(ink, 40),
                background: `linear-gradient(to bottom, ${mix(ink, 18)}, ${mix(ink, 4)})`,
              }),
        }}
      >
        {!ghost && (
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: mix(ink, 65) }}
          />
        )}
        <span
          className={cn(
            "font-heading font-bold tabular-nums",
            engraved,
            ghost && "text-fd-muted-foreground/20",
          )}
          style={ghost ? undefined : { color: mix(ink, 28) }}
          aria-hidden
        >
          {rank}
        </span>
      </div>
    </li>
  );
}

/**
 * The supporters board: a three-step podium for the top three, then everyone
 * else as a plain ranked list.
 *
 * It ranks by the total given since launch and never shows an amount, so the
 * only thing a step can carry is the place itself: the height, the metal and
 * the crown are what say how the three differ.
 */
export function SupportersPodium({ supporters }: { supporters: PodiumSupporter[] }) {
  const byRank = new Map(supporters.slice(0, 3).map((s) => [s.rank, s]));
  const rest = supporters.slice(3);

  return (
    <div className="space-y-6">
      <ol className="flex items-end justify-center gap-2 border-b border-fd-border sm:gap-4">
        {[1, 2, 3].map((rank) => (
          <Place key={rank} rank={rank} supporter={byRank.get(rank) ?? null} />
        ))}
      </ol>
      {rest.length > 0 && (
        <ol className="flex flex-col divide-y divide-fd-border text-sm">
          {rest.map((s) => (
            <li key={s.rank} className="flex items-center gap-3 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fd-muted text-[11px] font-semibold tabular-nums text-fd-muted-foreground">
                {s.rank}
              </span>
              <span
                className={cn("truncate", s.anonymous && "italic opacity-70")}
                title={s.name}
              >
                {s.name}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
