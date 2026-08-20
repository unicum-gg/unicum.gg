import {
  MAX_STARS,
  RATING_COLOR_HEX,
  starRatingColor,
  VOTER_BRACKET_LABEL,
  VoterBracket,
  wn8Color,
  type BracketVerdict,
} from "@unicum.gg/shared";
import { Stars, StarValue } from "./stars";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The same tank, rated by four different populations.
 *
 * This is the panel the whole feature exists for. A single community average
 * silently assumes everyone is answering the same question, and on a vehicle
 * that punishes mistakes they are not: the players who bounce off it and the
 * players who carry games in it both answer honestly and land two stars apart.
 * Averaging them together produces a number that describes nobody, and worse,
 * it produces the same number for a tank that is merely mediocre.
 *
 * So the split is the headline of the panel rather than a footnote, and the
 * spread between the ends is called out in words: a tank the good players rate
 * a star and a half above everyone else is a tank you have to earn.
 *
 * Brackets nobody has voted from are still drawn, greyed. An empty Unicum row
 * is information ("no strong player has said anything about this yet"), and
 * dropping it would silently change what the reader thinks they are comparing.
 */

/** Where each bracket's boundary sits, so the label can be coloured on the same
 * WN8 ladder the rest of the site paints ratings with. The value is the middle
 * of the band rather than its floor, so `Average` does not read as the colour
 * of its worst member. */
const BRACKET_ANCHOR: Record<VoterBracket, number | null> = {
  [VoterBracket.Learning]: 700,
  [VoterBracket.Average]: 1250,
  [VoterBracket.Strong]: 1950,
  [VoterBracket.Unicum]: 2700,
  [VoterBracket.Unknown]: null,
};

export function BracketSplit({ brackets }: { brackets: BracketVerdict[] }) {
  const rated = brackets.filter((b) => b.votes > 0);
  if (rated.length === 0) return null;

  const scale = Math.max(...rated.map((b) => b.votes));
  const gap = skillGap(brackets);

  return (
    <div className="flex flex-col gap-4">
      {gap ? (
        <p className="text-sm text-fd-muted-foreground">
          {gap.direction === "up" ? (
            <>
              Stronger players rate it{" "}
              <span className="font-medium text-fd-foreground tabular-nums">
                {gap.delta.toFixed(1)}
              </span>{" "}
              stars higher than the rest of the server. This one rewards knowing
              what you are doing.
            </>
          ) : (
            <>
              Stronger players rate it{" "}
              <span className="font-medium text-fd-foreground tabular-nums">
                {gap.delta.toFixed(1)}
              </span>{" "}
              stars lower than the rest of the server. It flatters until it is
              asked to do something.
            </>
          )}
        </p>
      ) : null}

      <div className="flex flex-col divide-y divide-fd-border">
        {brackets.map((bracket) => (
          <BracketRow key={bracket.bracket} verdict={bracket} scale={scale} />
        ))}
      </div>
    </div>
  );
}

function BracketRow({
  verdict,
  scale,
}: {
  verdict: BracketVerdict;
  scale: number;
}) {
  const anchor = BRACKET_ANCHOR[verdict.bracket];
  const labelColor = anchor == null ? undefined : RATING_COLOR_HEX[wn8Color(anchor)];
  const empty = verdict.votes === 0;

  return (
    <div
      className={`grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[6.5rem_auto_1fr] ${
        empty ? "opacity-40" : ""
      }`}
    >
      <span
        className="text-sm font-medium"
        style={labelColor ? { color: labelColor } : undefined}
      >
        {VOTER_BRACKET_LABEL[verdict.bracket]}
      </span>

      <div className="flex items-center gap-2">
        <StarValue value={verdict.overall} className="w-10 text-sm" />
        <Stars value={verdict.overall} size={13} />
      </div>

      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        {/* How many of them said it, as a share of the loudest bracket. A
          verdict from six people and one from six hundred should not look
          alike, and the number alone does not carry that at a glance. */}
        <div className="h-1.5 w-full max-w-[8rem] overflow-hidden rounded-sm bg-fd-border/60">
          <div
            className="h-full rounded-sm"
            style={{
              width: scale > 0 ? `${(verdict.votes / scale) * 100}%` : "0%",
              backgroundColor:
                verdict.overall == null
                  ? undefined
                  : RATING_COLOR_HEX[starRatingColor(verdict.overall)],
            }}
          />
        </div>
        <span className="whitespace-nowrap text-xs text-fd-muted-foreground tabular-nums">
          {empty
            ? "no votes"
            : `${intFmt.format(verdict.votes)} ${verdict.votes === 1 ? "vote" : "votes"}`}
          {verdict.avgBattles != null ? (
            <> &middot; {intFmt.format(Math.round(verdict.avgBattles))} battles</>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/**
 * The distance between what the strong players say and what everyone else does.
 *
 * Deliberately coarse: the two ends of the ladder against the two middle rungs,
 * rather than a regression nobody would trust on forty votes. Null unless both
 * sides have enough voices to mean something and the gap is wide enough to be
 * about the tank rather than about the sample.
 */
function skillGap(
  brackets: BracketVerdict[],
): { delta: number; direction: "up" | "down" } | null {
  const at = (bracket: VoterBracket) =>
    brackets.find((b) => b.bracket === bracket);

  const top = [at(VoterBracket.Strong), at(VoterBracket.Unicum)];
  const rest = [at(VoterBracket.Learning), at(VoterBracket.Average)];

  const weighted = (slice: (BracketVerdict | undefined)[]) => {
    const votes = slice.reduce((sum, b) => sum + (b?.votes ?? 0), 0);
    if (votes < MIN_SIDE_VOTES) return null;
    const total = slice.reduce(
      (sum, b) => sum + (b?.overall ?? 0) * (b?.votes ?? 0),
      0,
    );
    return total / votes;
  };

  const topMean = weighted(top);
  const restMean = weighted(rest);
  if (topMean == null || restMean == null) return null;

  const delta = topMean - restMean;
  if (Math.abs(delta) < MIN_MEANINGFUL_GAP) return null;
  return {
    delta: Math.abs(Math.min(Math.max(delta, -MAX_STARS), MAX_STARS)),
    direction: delta > 0 ? "up" : "down",
  };
}

/** Votes each side of the comparison needs before the gap is worth a sentence.
 * Below this it is two people disagreeing, which is not a fact about the tank. */
const MIN_SIDE_VOTES = 8;
/** Half a star. Under that, the difference is inside the noise of a five-step
 * scale and saying it out loud would be inventing a finding. */
const MIN_MEANINGFUL_GAP = 0.5;
