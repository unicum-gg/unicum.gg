import { dateFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
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
import type { TankHistoryVersions } from "@/app/[locale]/(site)/[region]/tanks/[slug]/detail";

const DATE_PATTERN = "d MMM yyyy";

/**
 * The History tab: every characteristic change a tank has gone through, grouped
 * by game version, newest first. Buffs are green, nerfs are red, at the same
 * direction the specifications table colours them (a shorter reload is a buff).
 *
 * The history is built forward from when tracking started (Wargaming keeps no
 * archive of past client versions), so the first version shown is the first one
 * that changed this tank, not the tank's whole life.
 */
export async function TankChangesHistory({
  versions,
  testVersion,
  testChanges,
  devVersion,
  releasedVersion,
  releasedAt, locale,
}: {
  versions: TankHistoryVersions;
  /** The Common Test build `testChanges` was read from, null when none runs. */
  testVersion: string | null;
  /** What the running test changes about this tank. Not history: it has not
   * shipped, and may still be rebalanced or dropped before it does. */
  testChanges: { field: string; previous: number | null; next: number | null }[];
  /** Set when the tank has been seen on the Common Test client and in no live
   * one yet. Long unused, for want of a reliable pre-release signal; the CT
   * branch of our own mirror is that signal. */
  devVersion: string | null;
  devAt: Date | null;
  /** The version the tank was released in, or null (predates our tracking). */
  releasedVersion: string | null;
  releasedAt: Date | null;
  tankName: string;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/history/index", locale);
  const { t: tStats } = await getTranslation("components/stat-labels", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  // Each version is a section; sections are joined by the site's diagonal
  // spacer (PanelSeparator), not a margin gap. Versions whose changes are all
  // untracked fields are dropped up front, so the spacer interleaving stays right.
  const sections = versions
    .map((version) => ({
      version,
      changes: version.changes
        .map((c) => formatSpecChange(c.field, c.previous, c.next, locale))
        .filter((c): c is FormattedChange => c !== null),
    }))
    .filter((s) => s.changes.length > 0);

  const pending = testChanges
    .map((c) => formatSpecChange(c.field, c.previous, c.next, locale))
    .filter((c): c is FormattedChange => c !== null);

  return (
    <>
      {/* Ahead of the shipped history, and visibly apart from it: these are the
          only changes on this page that have not happened yet. */}
      {pending.length > 0 ? (
        <Panel className="border border-brand/40" screenLines={false}>
          <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <PanelTitle>
              <span className="text-brand">{tGame("features.common-test")}</span>
              {testVersion ? (
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                  {testVersion}
                </span>
              ) : null}
            </PanelTitle>
            <div className="flex items-center gap-3 text-xs tabular-nums">
              {pending.filter((c) => c.isBuff === true).length > 0 ? (
                <span className="text-emerald-500">
                  {t("n-buffed", {
                    count: pending.filter((c) => c.isBuff === true).length,
                  })}
                </span>
              ) : null}
              {pending.filter((c) => c.isBuff === false).length > 0 ? (
                <span className="text-red-500">
                  {t("n-nerfed", {
                    count: pending.filter((c) => c.isBuff === false).length,
                  })}
                </span>
              ) : null}
            </div>
          </PanelHeader>
          <PanelContent className="p-0">
            <p className="px-4 pt-3 text-xs text-fd-muted-foreground">
              {t("not-released-wargaming-can-still")}</p>
            <ul className="divide-y divide-fd-border">
              {pending.map((change) => (
                <ChangeRow
                  key={change.field}
                  change={change}
                  className="px-4"
                  tStats={tStats}
                />
              ))}
            </ul>
          </PanelContent>
        </Panel>
      ) : null}
      {pending.length > 0 && sections.length > 0 ? <PanelSeparator /> : null}
      {sections.map(({ version, changes }, i) => {
        const buffs = changes.filter((c) => c.isBuff === true).length;
        const nerfs = changes.filter((c) => c.isBuff === false).length;
        return (
          <Fragment key={version.gameVersion}>
            {i > 0 ? <PanelSeparator /> : null}
            <Panel>
              <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <PanelTitle>
                  {t("update", { version: version.gameVersion })}
                  <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
                    {dateFormat(locale, DATE_PATTERN).format(new Date(version.capturedAt))}
                  </span>
                </PanelTitle>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  {buffs > 0 ? (
                    <span className="text-emerald-500">
                      {t("n-buffed", { count: buffs })}
                    </span>
                  ) : null}
                  {nerfs > 0 ? (
                    <span className="text-red-500">
                      {t("n-nerfed", { count: nerfs })}
                    </span>
                  ) : null}
                </div>
              </PanelHeader>
              <PanelContent className="p-0">
                <ul className="divide-y divide-fd-border">
                  {changes.map((change) => (
                    <ChangeRow
                      tStats={tStats}
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
            <PanelTitle>{t("lifecycle")}</PanelTitle>
          </PanelHeader>
          <PanelContent className="p-0">
            <ul className="divide-y divide-fd-border">
              {releasedVersion ? (
                <LifecycleRow
                  locale={locale}
                  label={t("introduced")}
                  version={releasedVersion}
                  at={releasedAt}
                />
              ) : devVersion ? (
                // Seen on the test client and not yet in a live one: it has no
                // introduction to state, and saying it predates our tracking
                // would date an unreleased tank to the past.
                <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="text-fd-muted-foreground">{t("status")}</span>
                  <span className="font-medium">{t("in-common-test-not-released")}</span>
                </li>
              ) : (
                // Present before our tracking started: the real introduction date
                // is unknown, so we can only say it predates that update.
                <LifecycleRow
                  locale={locale}
                  label={t("introduced")}
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

async function LifecycleRow({
  label,
  version,
  at,
  before = false,
  locale,
}: {
  label: string;
  version: string;
  at: Date | null;
  /** Render "Before update X" (the tank predates our tracking window). */
  before?: boolean;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/tanks/detail/history/index",
    locale,
  );
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-fd-muted-foreground">{label}</span>
      <span className="tabular-nums">
        <span className="font-medium">
          {t(before ? "before-update" : "update", { version })}
        </span>
        {at ? (
          <span className="ml-2 text-xs text-fd-muted-foreground">
            {dateFormat(locale, DATE_PATTERN).format(new Date(at))}
          </span>
        ) : null}
      </span>
    </li>
  );
}

