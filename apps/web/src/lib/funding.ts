// Shared funding math for the /support page's bar, the top-bar mini bar and the
// /api/support/funding endpoint, so the "how much of what we have spent since
// launch is covered" figure is computed one way everywhere.

/** unicum.gg went live on this day: the anchor for how long it has run at a loss
 * and the cumulative infrastructure bill the community is helping recoup. */
export const PROJECT_START = new Date("2026-05-28T00:00:00Z");

// Pledges are billed in EUR; costs are modelled in USD. Same rate the coverage
// cost breakdown uses, so the funding bar stays consistent with it.
export const USD_PER_EUR = 1.08;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

export type FundingProgress = {
  daysRunning: number;
  /** Cumulative infrastructure spend since launch (USD): the bar's target. */
  goalUsd: number;
  /** Share of that total covered by supporters, 0-100 (integer). */
  pct: number;
};

/**
 * Cumulative funding progress: total received measured against the total spent
 * since launch (a target that grows every day). `nowMs` is passed in so callers
 * decide the clock (server request time vs client render time).
 */
export function fundingProgress(
  monthlyCostUsd: number,
  receivedUsd: number,
  nowMs: number,
): FundingProgress {
  const daysRunning = Math.max(
    1,
    Math.floor((nowMs - PROJECT_START.getTime()) / MS_PER_DAY),
  );
  const goalUsd = monthlyCostUsd * (daysRunning / DAYS_PER_MONTH);
  const pct =
    goalUsd > 0
      ? Math.max(0, Math.min(100, Math.round((receivedUsd / goalUsd) * 100)))
      : 0;
  return { daysRunning, goalUsd, pct };
}
