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

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

type BotUsage = Awaited<ReturnType<typeof unicum.usage.bot>>;

/**
 * The bot page's numbers: the servers it is in and the commands it answers.
 * Both are recorded by us (Discord keeps no history of either), so the curves
 * begin when the recording did, which the note says. Opens with its own
 * separator so it can be dropped between two panels.
 */
export async function BotUsagePanel({ locale }: { locale: string }) {
  const { t } = await getTranslation("components/usage/bot-usage-panel", locale);
  const usage = await buildSafe<BotUsage | null>(() => unicum.usage.bot(), null);
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {usage.guilds !== null && (
              <StatCell label={t("servers")} value={n(usage.guilds)} />
            )}
            <StatCell label={t("commands-month")} value={n(usage.commandsMonth)} />
            <StatCell label={t("commands-all-time")} value={n(usage.commandsAllTime)} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {usage.guildsDaily.length > 1 && (
              <CoverageAreaChart
                title={t("servers")}
                data={usage.guildsDaily}
                ariaLabel={t("servers-last-30-days")}
                allowCumulative={false}
              />
            )}
            {usage.commandsDaily.length > 1 && (
              <CoverageAreaChart
                title={t("commands")}
                data={usage.commandsDaily}
                ariaLabel={t("commands-last-30-days")}
                allowCumulative={false}
              />
            )}
          </div>
          {usage.commands.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {usage.commands.map((c) => (
                <StatCell key={c.command} label={`/${c.command}`} value={n(c.count)} />
              ))}
            </div>
          )}
          <p className="text-xs text-fd-muted-foreground">{t("note")}</p>
        </PanelContent>
      </Panel>
    </>
  );
}
