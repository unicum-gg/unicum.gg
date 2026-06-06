import APP from "@/constants/app";

/**
 * Date when 30-day delta data becomes complete across all regions. Snapshot
 * collection started 2026-05-29, plus 30 days. Once we cross this, the banner
 * hides itself and the file can be deleted at leisure.
 */
const DATA_COMPLETE_AT = new Date("2026-06-28T00:00:00Z");

export function BuildBanner() {
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request; we want fresh "now" so the banner self-hides past the target date
  if (Date.now() >= DATA_COMPLETE_AT.getTime()) return null;
  return (
    <div className="border-b border-[#f25322]/30 bg-[#f25322]/10 px-4 py-2.5 text-center text-xs leading-relaxed text-fd-foreground">
      <p>{APP.NAME} launched recently and is still growing.</p>
      <p>Each passing day adds depth to every player&apos;s history.</p>
      <p>Full 30-day comparisons unlock on June 28, 2026.</p>
    </div>
  );
}
