// What a contribution to the site can be, and the bounds it has to fall in.
// Client-safe and pure, so the Stripe helper, the checkout route and the
// /support widget all read one floor rather than each keeping a copy of it (the
// widget's was a second hardcoded 3).

/**
 * How a contribution is taken. The amount is free either way: `Monthly` opens a
 * subscription the supporter controls from the billing portal, `OneOff` takes a
 * single payment and commits them to nothing.
 */
export enum SupportMode {
  Monthly = "monthly",
  OneOff = "one-off",
}

/** Whether an untrusted value (a request body) names a support mode. */
export function isSupportMode(value: unknown): value is SupportMode {
  return (Object.values(SupportMode) as unknown[]).includes(value);
}

// Pay-what-you-want bounds (EUR cents): 3 EUR floor, 1000 EUR sanity cap. The
// floor is the same for both modes: a payment smaller than that is mostly
// payment fees, whether it recurs or not.
export const SUPPORT_MIN_CENTS = 300;
export const SUPPORT_MAX_CENTS = 100_000;

/** The amounts the widget offers as buttons, in euros. */
export const SUPPORT_PRESETS_EUR = [3, 5, 10, 20, 50, 100] as const;

/** Hold a requested amount inside the bounds, in cents. */
export function clampSupportAmount(cents: number): number {
  return Math.min(
    Math.max(Math.round(cents), SUPPORT_MIN_CENTS),
    SUPPORT_MAX_CENTS,
  );
}

/**
 * How long a supporter has held their monthly pledge, as the crest wears it:
 * the plain supporter crest, then bronze, silver and gold. Only seniority moves
 * it, never the amount, so a 3 EUR pledge held for a year outranks a large one
 * started last week: what the crest rewards is staying.
 */
export enum SupporterTier {
  Base = "base",
  Bronze = "bronze",
  Silver = "silver",
  Gold = "gold",
}

/** Months of unbroken monthly support each metal takes. */
export const SUPPORTER_TIER_MONTHS: Record<
  Exclude<SupporterTier, SupporterTier.Base>,
  number
> = {
  [SupporterTier.Bronze]: 3,
  [SupporterTier.Silver]: 6,
  [SupporterTier.Gold]: 12,
};

/**
 * Whole calendar months from `since` to `nowMs`, the way a subscription is
 * billed: a pledge started on the 31st has its first month on the last day of
 * the next one rather than drifting by the length of February.
 */
export function supporterMonths(since: Date, nowMs: number): number {
  const now = new Date(nowMs);
  let months =
    (now.getUTCFullYear() - since.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - since.getUTCMonth());
  if (now.getUTCDate() < since.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** The tier a supporter of `months` months wears. */
export function supporterTier(months: number): SupporterTier {
  if (months >= SUPPORTER_TIER_MONTHS[SupporterTier.Gold]) return SupporterTier.Gold;
  if (months >= SUPPORTER_TIER_MONTHS[SupporterTier.Silver]) return SupporterTier.Silver;
  if (months >= SUPPORTER_TIER_MONTHS[SupporterTier.Bronze]) return SupporterTier.Bronze;
  return SupporterTier.Base;
}
