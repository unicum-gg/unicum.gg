import APP from "@/constants/app";
import { LoginWidget } from "./login-widget";
import { PlayersOnline } from "./players-online";

/**
 * Date when 30-day delta data becomes complete across all regions. Pushed
 * from late June to late July: EU has a ~669k unfetched backlog (real
 * players discovered via clan walks, still awaiting first snapshot), and
 * draining it at the current ~60k/day first-snap rate plus 30 days of
 * history land us around end of July. Once we cross this, the banner hides
 * itself and the file can be deleted at leisure.
 */
const DATA_COMPLETE_AT = new Date("2026-07-31T00:00:00Z");

export function BuildBanner() {
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request; we want a fresh "now" so the banner self-hides past the target date
  const now = Date.now();
  if (now >= DATA_COMPLETE_AT.getTime()) return null;

  return (
    <div className="border-b border-[#f25322]/30 bg-linear-to-r from-[#f25322]/15 via-[#f25322]/5 to-[#f25322]/15">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex h-9 items-center gap-3 border-x border-fd-border px-4 text-xs">
          <PlayersOnline />
          <p className="flex-1 truncate text-center text-fd-foreground">
            <span className="font-medium">{APP.NAME}</span> is building &middot;{" "}
            <span className="text-fd-muted-foreground">
              full 30-day data by end of July
            </span>
          </p>
          <LoginWidget />
        </div>
      </div>
    </div>
  );
}
