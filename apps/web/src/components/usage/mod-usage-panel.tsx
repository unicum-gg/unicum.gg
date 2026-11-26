import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { CoverageAreaChart } from "@/components/coverage/coverage-charts-lazy";
import { StatCell } from "@/components/coverage/stat-cell";
import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

type ModUsage = Awaited<ReturnType<typeof unicum.usage.mod>>;

/**
 * The mod page's numbers: who runs it and how much it sends. On the page a
 * player reads while deciding whether to install it, which is where they
 * mean something. Renders nothing rather than a row of zeroes when the figures
 * could not be read, and opens with its own separator so it can be dropped
 * between two panels.
 */
export async function ModUsagePanel({ locale }: { locale: string }) {
  const { t } = await getTranslation("components/usage/mod-usage-panel", locale);
  const usage = await buildSafe<ModUsage | null>(() => unicum.usage.mod(), null);
  if (!usage) return null;
  const n = (value: number) => numberFormat(locale, INT_FORMAT).format(value);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-6 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCell label={t("players")} value={n(usage.users)} />
            <StatCell label={t("battles")} value={n(usage.battles)} />
            <StatCell label={t("active-week")} value={n(usage.activeWeek)} />
            <StatCell label={t("active-month")} value={n(usage.activeMonth)} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CoverageAreaChart
              title={t("battles-sent")}
              data={usage.battlesDaily}
              ariaLabel={t("battles-sent-last-30-days")}
              allowCumulative={false}
            />
            <CoverageAreaChart
              title={t("players-sending")}
              data={usage.uploadersDaily}
              ariaLabel={t("players-sending-last-30-days")}
              allowCumulative={false}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {usage.regions.map((r) => (
              <StatCell
                key={r.region}
                label={`${REGION_EMOJI[r.region]} ${REGION_LABEL[r.region]}`}
                value={t("region-line", { players: n(r.users), battles: n(r.battles) })}
              />
            ))}
          </div>
          <p className="text-xs text-fd-muted-foreground">{t("note")}</p>
        </PanelContent>
      </Panel>
    </>
  );
}
