import {
  RATING_HYPE_LABEL,
  ratingHype,
  RatingHype,
} from "@unicum.gg/shared";

const pctFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * What players think, next to what the tank actually does.
 *
 * Both sides are the vehicle's rank inside its own tier: where the community
 * puts it, and where its measured win rate puts it. The tier is the unit
 * because matchmaking moves the whole scale with it, so a tier V's 51% and a
 * tier X's 51% are not the same achievement.
 *
 * The gap is the interesting part, and it is a genuinely new number: reputation
 * is a thing everyone has an opinion about and nobody measures, and we happen to
 * hold both halves. A tank the server adores and that loses games is a tank
 * whose reputation is doing the work.
 */
export function HypeGauge({
  hype,
  perceived,
  measured,
  tier,
}: {
  hype: number | null;
  perceived: number | null;
  measured: number | null;
  tier: number;
}) {
  const verdict = ratingHype(hype);
  if (verdict == null || perceived == null || measured == null) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        Not enough votes yet to compare the community&apos;s verdict against how
        the tank actually performs.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="rounded-md px-2 py-0.5 text-sm font-semibold text-white"
          style={{ backgroundColor: HYPE_COLOR[verdict] }}
        >
          {RATING_HYPE_LABEL[verdict]}
        </span>
        <span className="text-sm text-fd-muted-foreground">
          {VERDICT_LINE[verdict]}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <PercentileBar
          label="What players think"
          hint={`Where the community ranks it among the rated tier ${tier} tanks`}
          value={perceived}
          tone="var(--color-fd-primary)"
        />
        <PercentileBar
          label="What the data says"
          hint={`Where its win rate ranks it among the same tanks`}
          value={measured}
          tone="var(--color-fd-muted-foreground)"
        />
      </div>
    </div>
  );
}

/**
 * The bar is a rank, not a score, so the label says what it is a rank among: a
 * bare percentage here would be read as a win rate, which is exactly the number
 * one of the two bars is derived from and exactly not what either one means.
 *
 * "Rated" is load-bearing in that label. Both halves are ranked over the same
 * population, the tier's rated vehicles, because that is the only set the
 * community half can be ranked over at all, and ranking the two over different
 * sets would make their difference measure which tanks people bothered to rate.
 */
function PercentileBar({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-fd-muted-foreground tabular-nums">
          above {pctFmt.format(value * 100)}% of the rated tanks in its tier
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-fd-border/60">
        <div
          className="h-full rounded-sm"
          style={{ width: `${value * 100}%`, backgroundColor: tone }}
        />
      </div>
      <span className="text-xs text-fd-muted-foreground">{hint}</span>
    </div>
  );
}

const HYPE_COLOR: Record<RatingHype, string> = {
  [RatingHype.Overrated]: "#D77900",
  [RatingHype.Fair]: "#4A92B7",
  [RatingHype.Underrated]: "#6D9521",
};

const VERDICT_LINE: Record<RatingHype, string> = {
  [RatingHype.Overrated]:
    "The community rates it well above what it actually achieves.",
  [RatingHype.Fair]: "Reputation and results agree on this one.",
  [RatingHype.Underrated]:
    "It performs better than anybody gives it credit for.",
};
