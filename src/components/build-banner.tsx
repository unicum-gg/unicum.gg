import { Construction } from "lucide-react";
import APP from "@/constants/app";

/**
 * Date when 30-day delta data becomes complete across all regions. Pushed
 * from late June to late July: EU has a ~669k unfetched backlog (real
 * players discovered via clan walks, still awaiting first snapshot), and
 * draining it at the current ~60k/day first-snap rate plus 30 days of
 * history land us around end of July. Once we cross this, the banner hides
 * itself and the file can be deleted at leisure.
 */
const DATA_COMPLETE_AT = new Date("2026-07-31T00:00:00Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function BuildBanner() {
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request; we want fresh "now" so the banner self-hides past the target date and the counter ticks down day by day
  const now = Date.now();
  if (now >= DATA_COMPLETE_AT.getTime()) return null;
  const daysLeft = Math.ceil((DATA_COMPLETE_AT.getTime() - now) / MS_PER_DAY);

  return (
    <div className="border-b border-[#f25322]/30 bg-linear-to-r from-[#f25322]/15 via-[#f25322]/5 to-[#f25322]/15">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex h-9 items-center gap-3 border-x border-fd-border px-4 text-xs">
          <Construction className="size-3.5 shrink-0 text-[#f25322]" />
          <p className="flex-1 truncate text-center text-fd-foreground">
            <span className="font-medium">{APP.NAME}</span> is building &middot;{" "}
            <span className="text-fd-muted-foreground">
              full 30-day data by end of July
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono tabular-nums text-fd-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {daysLeft}d
          </span>
        </div>
      </div>
    </div>
  );
}
