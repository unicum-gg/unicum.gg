import { Fragment } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  formatSpecChange,
  type FormattedChange,
} from "@/components/tanks/change-format";
import { ChangeRow } from "@/components/tanks/change-row";
import { TANK_HISTORY_TRACKING_START } from "@unicum.gg/shared";
import type { TankHistoryVersions } from "@/app/(site)/[region]/tanks/[slug]/detail";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * The History tab: every characteristic change a tank has gone through, grouped
 * by game version, newest first. Buffs are green, nerfs are red, at the same
 * direction the specifications table colours them (a shorter reload is a buff).
 *
 * The history is built forward from when tracking started (Wargaming keeps no
 * archive of past client versions), so the first version shown is the first one
 * that changed this tank, not the tank's whole life.
 */
export function TankChangesHistory({
  versions,
  releasedVersion,
  releasedAt,
}: {
  versions: TankHistoryVersions;
  // Kept for payload compatibility; the dev-stub phase was dropped (the mirror
  // has no reliable pre-release signal), so these are always null and unused.
  devVersion: string | null;
  devAt: Date | null;
  /** The version the tank was released in, or null (predates our tracking). */
  releasedVersion: string | null;
  releasedAt: Date | null;
  tankName: string;
}) {
  // Each version is a section; sections are joined by the site's diagonal
  // spacer (PanelSeparator), not a margin gap. Versions whose changes are all
  // untracked fields are dropped up front, so the spacer interleaving stays right.
  const sections = versions
    .map((version) => ({
      version,
      changes: version.changes
        .map((c) => formatSpecChange(c.field, c.previous, c.next))
        .filter((c): c is FormattedChange => c !== null),
    }))
    .filter((s) => s.changes.length > 0);

  return (
    <>
      {sections.map(({ version, changes }, i) => {
        const buffs = changes.filter((c) => c.isBuff === true).length;
        const nerfs = changes.filter((c) => c.isBuff === false).length;
        return (
          <Fragment key={version.gameVersion}>
            {i > 0 ? <PanelSeparator /> : null}
            <Panel>
              <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <PanelTitle>
                  Update {version.gameVersion}
                  <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                    {dateFmt.format(new Date(version.capturedAt))}
                  </span>
                </PanelTitle>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  {buffs > 0 ? (
                    <span className="text-emerald-500">{buffs} buffed</span>
                  ) : null}
                  {nerfs > 0 ? (
                    <span className="text-red-500">{nerfs} nerfed</span>
                  ) : null}
                </div>
              </PanelHeader>
              <PanelContent className="p-0">
                <ul className="divide-y divide-fd-border">
                  {changes.map((change) => (
                    <ChangeRow
                      key={change.field}
                      change={change}
                      className="px-4"
                    />
                  ))}
                </ul>
              </PanelContent>
            </Panel>
          </Fragment>
        );
      })}

      <>
        {sections.length > 0 ? <PanelSeparator /> : null}
        <Panel>
          <PanelHeader>
            <PanelTitle>Lifecycle</PanelTitle>
          </PanelHeader>
          <PanelContent className="p-0">
            <ul className="divide-y divide-fd-border">
              {releasedVersion ? (
                <LifecycleRow
                  label="Introduced"
                  version={releasedVersion}
                  at={releasedAt}
                />
              ) : (
                // Present before our tracking started: the real introduction date
                // is unknown, so we can only say it predates that update.
                <LifecycleRow
                  label="Introduced"
                  version={TANK_HISTORY_TRACKING_START.version}
                  at={null}
                  before
                />
              )}
            </ul>
          </PanelContent>
        </Panel>
      </>
    </>
  );
}

function LifecycleRow({
  label,
  version,
  at,
  before = false,
}: {
  label: string;
  version: string;
  at: Date | null;
  /** Render "Before update X" (the tank predates our tracking window). */
  before?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-fd-muted-foreground">{label}</span>
      <span className="tabular-nums">
        <span className="font-medium">
          {before ? "Before update " : "Update "}
          {version}
        </span>
        {at ? (
          <span className="ml-2 text-xs text-fd-muted-foreground">
            {dateFmt.format(new Date(at))}
          </span>
        ) : null}
      </span>
    </li>
  );
}

