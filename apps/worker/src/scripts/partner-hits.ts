// Print how many people followed each creator's vanity link, per day.
//
//   pnpm --filter @unicum.gg/worker partner-hits [days] [slug ...]
//
// Reach for it at the end of a partnership, which is the moment it exists for:
// the figure it prints is what decides whether the next month is worth paying
// for, and before it there was nothing to decide on but a feeling.
//
// It is a script rather than a page on the site, because the audience is one
// person and the question is asked once a month.
import { PARTNERS } from "@unicum.gg/core/partners";
import { readPartnerHits } from "@unicum.gg/core/partners/hits";
import { getRedisClient } from "@unicum.gg/core/redis";

const DEFAULT_DAYS = 30;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const days = Number(args[0]) > 0 ? Number(args[0]) : DEFAULT_DAYS;
  const slugs = args.filter((a) => !/^\d+$/.test(a));
  const wanted = slugs.length ? slugs : PARTNERS.map((p) => p.slug);

  // Refuses rather than printing a table of zeroes: without Redis there is no
  // counter at all, and a run that says "0 hits" would read as an answer.
  if (!getRedisClient()) {
    console.error("partner-hits: REDIS_URL is not set, nothing was counted");
    process.exit(1);
  }

  const rows = await readPartnerHits(wanted, days);
  const byDay = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!byDay.has(row.day)) byDay.set(row.day, new Map());
    byDay.get(row.day)?.set(row.slug, row.hits);
    totals.set(row.slug, (totals.get(row.slug) ?? 0) + row.hits);
  }

  const width = Math.max(8, ...wanted.map((s) => s.length));
  console.log(["day".padEnd(10), ...wanted.map((s) => s.padStart(width))].join(" "));
  for (const [day, counts] of byDay) {
    // A day nobody clicked on is still a day of the partnership, so it is
    // printed as a zero rather than skipped: the gaps are half of what the
    // series says.
    const cells = wanted.map((s) => String(counts.get(s) ?? 0).padStart(width));
    console.log([day.padEnd(10), ...cells].join(" "));
  }
  console.log(
    ["total".padEnd(10), ...wanted.map((s) => String(totals.get(s) ?? 0).padStart(width))].join(" "),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[partner-hits] failed:", err);
  process.exit(1);
});
