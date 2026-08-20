import {
  RATING_CONSENSUS_LABEL,
  type RatingConsensus,
  type TankRatingSummary,
} from "@unicum.gg/shared";
import { Stars, StarValue } from "./stars";
import { StarHistogram } from "./histogram";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The headline: what the community makes of this tank, and how much weight that
 * carries.
 *
 * The two figures sit side by side because they answer different questions and
 * regularly disagree. A tank can be strong and joyless, or bad and beloved, and
 * a single score would average those into a number that describes neither.
 *
 * The line under them is the part no other community average prints: the mean
 * number of battles the voters have on the tank. That is the difference between
 * a verdict and a poll.
 */
export function CommunityVerdict({
  summary,
}: {
  summary: TankRatingSummary;
}) {
  if (summary.votes === 0) return <NoVotesYet />;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ScoreBlock
        label="Overall"
        hint="How good the tank is"
        value={summary.overall}
        votes={summary.votes}
        distribution={summary.overallDistribution}
        consensus={summary.consensus}
      />
      <ScoreBlock
        label="Fun"
        hint="How much people enjoy it"
        value={summary.fun}
        votes={summary.votes}
        distribution={summary.funDistribution}
      />
      <p className="text-xs text-fd-muted-foreground sm:col-span-2">
        {summary.avgVoterBattles == null ? (
          "Every vote comes from an account that has played this tank."
        ) : (
          <>
            Every vote comes from an account that has played this tank, on
            average{" "}
            <span className="font-medium text-fd-foreground tabular-nums">
              {intFmt.format(Math.round(summary.avgVoterBattles))}
            </span>{" "}
            battles in it.
          </>
        )}
      </p>
    </div>
  );
}

function ScoreBlock({
  label,
  hint,
  value,
  votes,
  distribution,
  consensus,
}: {
  label: string;
  hint: string;
  value: number | null;
  votes: number;
  distribution: TankRatingSummary["overallDistribution"];
  consensus?: RatingConsensus | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <span className="text-xs text-fd-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-3">
        <StarValue value={value} className="text-3xl" />
        <div className="flex flex-col gap-1">
          <Stars value={value} size={18} />
          <span className="text-xs text-fd-muted-foreground tabular-nums">
            {intFmt.format(votes)} {votes === 1 ? "vote" : "votes"}
            {/* Said out loud rather than left in the standard deviation: a 3.0
              everyone agrees on and a 3.0 half the server fought over are
              different facts about the tank. */}
            {consensus ? (
              <> &middot; {RATING_CONSENSUS_LABEL[consensus].toLowerCase()}</>
            ) : null}
          </span>
        </div>
      </div>
      <StarHistogram bars={distribution} />
    </div>
  );
}

function NoVotesYet() {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">Nobody has rated this tank yet.</p>
      <p className="text-sm text-fd-muted-foreground">
        If you have played it, you are exactly who this page is waiting for.
      </p>
    </div>
  );
}
