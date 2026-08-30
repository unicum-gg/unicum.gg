// What running unicum.gg actually costs, in the currency it is actually billed
// in. Every amount here is a euro figure straight off an invoice, never a
// pre-converted one — see `currency.ts` for why.
//
// Two things drive the shape of this module, and both are about the cumulative
// total being money that really left the account rather than an average.
//
// Recurring lines are **dated**. A hosting bill is not one number: the site
// started on a small Contabo box and has moved three times since, so charging
// today's rate against every day since launch would invent money that was
// never spent.
// Closing a line and opening the next one is also how the next migration gets
// recorded, without touching the maths.
//
// Recurring lines are also **charged in whole cycles**, never prorated. These
// contracts are prepaid: you are billed the day you subscribe and then on each
// anniversary, so a VPS dropped after eight days still cost a full month, and a
// domain bought for a year cost the whole year on day one. Spreading either
// over the days it was used would under-report what has actually been paid.
//
// The ledger has three parts because they answer different questions. Lines
// billed today are the run-rate ("what does it cost to keep this alive"). Past
// lines and one-offs are money already gone. Only the first feeds the annual
// cost shown on /coverage; all three feed the cumulative "spent since launch"
// the funding bar measures supporters against.

/** unicum.gg went live on this day: the anchor for how long it has run at a
 * loss and the cumulative bill the community is helping recoup. */
export const PROJECT_START = new Date("2026-05-28T00:00:00Z");

const MS_PER_DAY = 86_400_000;

/** A cost billed on a repeating cycle. `to` is null while still being billed. */
export type Expense = {
  label: string;
  /** What a single charge costs. This is the primitive: it is the amount on
   * the invoice, and the cumulative counts these, not fractions of them. */
  eurPerCharge: number;
  /** Charges in a year: 12 monthly, 1 yearly. Kept as a plain number rather
   * than an enum so the wire shape needs no cast on the way through the SDK. */
  chargesPerYear: number;
  /** The line as a yearly cost, which is how the breakdown reads. */
  eurAnnual: number;
  /** The line as a monthly cost, which is how the run-rate reads. */
  eurMonthly: number;
  /** ISO calendar date (`YYYY-MM-DD`) of the first charge. */
  from: string;
  /** ISO calendar date it stopped, or null while still billed. */
  to: string | null;
  note?: string;
};

/** Money spent once, on a date. Counts toward the cumulative spend, never
 * toward the monthly run-rate. */
export type OneOffExpense = {
  label: string;
  eur: number;
  /** ISO calendar date (`YYYY-MM-DD`) the money left the account. */
  incurredAt: string;
  note?: string;
};

export type ExpenseLedger = {
  /** Billed today: the "estimated annual cost" headline and the run-rate. */
  recurring: Expense[];
  /** No longer billed, kept because it is still part of what the site cost. */
  past: Expense[];
  oneOff: OneOffExpense[];
  totalAnnualEur: number;
  totalOneOffEur: number;
};

const LAUNCH_DATE = PROJECT_START.toISOString().slice(0, 10);

type ExpenseInput = {
  label: string;
  eur: number;
  from?: string;
  to?: string;
  note?: string;
};

function expense(input: ExpenseInput, chargesPerYear: number): Expense {
  const eurAnnual = input.eur * chargesPerYear;
  return {
    label: input.label,
    eurPerCharge: input.eur,
    chargesPerYear,
    eurAnnual,
    eurMonthly: eurAnnual / 12,
    from: input.from ?? LAUNCH_DATE,
    to: input.to ?? null,
    note: input.note,
  };
}

/** A line billed every month, `eur` per charge. */
const monthly = (input: ExpenseInput) => expense(input, 12);
/** A line billed once a year, `eur` per charge. */
const yearly = (input: ExpenseInput) => expense(input, 1);

// Every machine the site has run on, in order. The dates are the days the
// switch was made; a closed line is never edited again, it is what was paid.
const HOSTING: Expense[] = [
  monthly({
    label: "VPS hosting",
    eur: 8.49,
    to: "2026-06-05",
    note: "Contabo Cloud VPS 10, 6 vCPU / 12 GB RAM",
  }),
  monthly({
    label: "VPS hosting",
    eur: 11.99,
    from: "2026-06-05",
    to: "2026-06-21",
    note: "OVH VPS-2, 6 vCPU / 12 GB RAM / 100 GB NVMe",
  }),
  monthly({
    label: "VPS hosting",
    // EUR 23.49 excl. VAT + 20% VAT, monthly no-commit billing.
    eur: 28.19,
    from: "2026-06-21",
    to: "2026-08-30",
    note: "OVH VPS-4, 8 vCPU / 24 GB RAM / 200 GB NVMe",
  }),
  monthly({
    label: "VPS hosting",
    // EUR 40.27 excl. VAT + 20% VAT, monthly no-commit billing.
    eur: 48.32,
    from: "2026-08-30",
    note: "netcup RS 4000 G12, 12 vCPU / 32 GB RAM / 1 TB NVMe",
  }),
];

/** One additional IPv4 per month at the current host. Each extra egress IP buys
 * its own G-Core per-IP rate budget, so Wargaming traffic can spread across
 * them. netcup bills EUR 1.68 excl. VAT; the OVH rate this replaced is recorded
 * on the closed line below rather than here. */
const EGRESS_IP_EUR_MONTHLY = 2.02;
/** The day the current host took over, and therefore the earliest a line priced
 * at its rate can start. */
const EGRESS_IPS_FROM = "2026-08-30";

// Egress-IP periods already paid for, closed and priced at the rate that was
// actually billed at the time. These are recorded rather than derived for the
// reason `buildExpenseLedger` explains: the live count only describes today, so
// leaving history to it means every change silently reprices the past. The
// OVH period ended with the move, and the machine it moved to runs on the one
// address that comes with it, so there is no open line to succeed it yet.
const EGRESS_IP_HISTORY: readonly Expense[] = [
  monthly({
    label: "Egress IPs",
    // EUR 1.99 excl. VAT + 20% VAT, one additional OVH IPv4.
    eur: 2.39,
    // Multi-IP egress went in with commits `dc6428a` through `de183f3`, all
    // within four hours of each other. Before that the site ran on the single
    // address that came with the VPS, so nothing is charged against the
    // earlier weeks.
    from: "2026-07-17",
    to: "2026-08-30",
    note: "1 additional OVH IPv4 for multi-IP Wargaming throughput",
  }),
];

// Deliberately absent: the OpenAI usage behind the daily changelog digest. It
// is paid personally rather than out of the project, so putting it here would
// ask supporters to cover something they are not being asked to cover. Noted
// because the omission otherwise reads as an oversight to anyone auditing this
// against what the site actually runs.

/** Every one-off already paid for out of pocket. Append-only: a line removed
 * here silently rewrites how much the site is said to have cost. */
const ONE_OFF_EXPENSES: readonly OneOffExpense[] = [
  {
    label: "Marketing",
    eur: 24.72,
    incurredAt: "2026-08-16",
    note: "Getting the site in front of World of Tanks players",
  },
];

/**
 * The full ledger. `additionalEgressIps` is passed in rather than read here so
 * this module stays client-safe: the count comes from server-only env on the
 * API side (`WG_EGRESS_*`), so the cost tracks reality as IPs are added or
 * dropped instead of being maintained by hand.
 *
 * That live count now prices only the OPEN line, never the past. It used to
 * price the whole multi-IP period, and on 2026-08-30 that cost the ledger its
 * history: cutting `WG_EGRESS_*` back to a single entry during the move took
 * the count to zero, and the two charges already paid in July and August
 * vanished from the cumulative. A ledger that revises what was spent is not a
 * ledger, so paid periods live in `EGRESS_IP_HISTORY` as closed lines and the
 * count below only ever opens the current one. When IPs are added, this line
 * appears from `EGRESS_IPS_FROM`; when they are dropped, close it there and
 * append it to the history, exactly like a hosting move.
 */
export function buildExpenseLedger(additionalEgressIps: number): ExpenseLedger {
  const lines: Expense[] = [
    ...HOSTING,
    yearly({
      label: "Domain",
      eur: 47.78,
      note: "unicum.gg, billed yearly",
    }),
    ...EGRESS_IP_HISTORY,
    ...(additionalEgressIps > 0
      ? [
          monthly({
            label: "Egress IPs",
            eur: additionalEgressIps * EGRESS_IP_EUR_MONTHLY,
            from: EGRESS_IPS_FROM,
            note: `${additionalEgressIps} additional IPv4 for multi-IP Wargaming throughput`,
          }),
        ]
      : []),
    monthly({
      label: "CDN, SSL, deploys",
      eur: 0,
      note: "Cloudflare free tier + Let's Encrypt + self-hosted Coolify",
    }),
  ];
  const recurring = lines.filter((line) => line.to === null);
  const oneOff = [...ONE_OFF_EXPENSES];
  return {
    recurring,
    past: lines.filter((line) => line.to !== null),
    oneOff,
    totalAnnualEur: recurring.reduce((sum, line) => sum + line.eurAnnual, 0),
    totalOneOffEur: oneOff.reduce((sum, line) => sum + line.eur, 0),
  };
}

/** Days the site has been running, floored, never below 1. */
export function daysSinceLaunch(nowMs: number): number {
  return Math.max(1, Math.floor((nowMs - PROJECT_START.getTime()) / MS_PER_DAY));
}

/** Sanity bound on the anniversary walk below, so a mistyped `from` can never
 * spin: a century of monthly charges. */
const MAX_CHARGES = 1200;

/**
 * How many times a line has actually been charged by `nowMs`. Subscriptions are
 * prepaid, so the first charge lands on `from` and the rest on each anniversary
 * — a line cancelled a week in still cost one full charge. Walks calendar
 * months rather than averaging day counts, so the anniversaries stay on their
 * real dates however long the line runs.
 */
export function chargesSoFar(line: Expense, nowMs: number): number {
  const endMs = Math.min(
    line.to ? Date.parse(`${line.to}T00:00:00Z`) : nowMs,
    nowMs,
  );
  const cursor = new Date(`${line.from}T00:00:00Z`);
  const monthsPerCycle = 12 / line.chargesPerYear;
  let count = 0;
  while (cursor.getTime() < endMs && count < MAX_CHARGES) {
    count++;
    cursor.setUTCMonth(cursor.getUTCMonth() + monthsPerCycle);
  }
  return count;
}

/**
 * Everything spent since launch: every charge that has actually been taken,
 * plus every one-off already incurred. Lines and one-offs dated in the future
 * are excluded, so either can be added ahead of the money leaving.
 */
export function spentSinceLaunchEur(
  ledger: ExpenseLedger,
  nowMs: number,
): number {
  const recurring = [...ledger.recurring, ...ledger.past].reduce(
    (sum, line) => sum + line.eurPerCharge * chargesSoFar(line, nowMs),
    0,
  );
  const oneOff = ledger.oneOff.reduce(
    (sum, line) => (Date.parse(line.incurredAt) <= nowMs ? sum + line.eur : sum),
    0,
  );
  return recurring + oneOff;
}

export type FundingProgress = {
  daysRunning: number;
  /** Cumulative spend since launch (EUR): the funding bar's target. */
  goalEur: number;
  /** Share of that total covered by supporters, 0-100 (integer). */
  pct: number;
};

/**
 * Cumulative funding progress: total received measured against the total spent
 * since launch (a target that steps up on each billing date). `nowMs` is passed
 * in so callers decide the clock (server request time vs client render time).
 */
export function fundingProgress(
  ledger: ExpenseLedger,
  receivedEur: number,
  nowMs: number,
): FundingProgress {
  const goalEur = spentSinceLaunchEur(ledger, nowMs);
  const pct =
    goalEur > 0
      ? Math.max(0, Math.min(100, Math.round((receivedEur / goalEur) * 100)))
      : 0;
  return { daysRunning: daysSinceLaunch(nowMs), goalEur, pct };
}
