import Link from "@/components/link";
import { Interpolate } from "@/components/interpolate";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { ChartMode } from "@/components/coverage/chart-mode";
import { CoverageAreaChart } from "@/components/coverage/coverage-charts-lazy";
import { CoverageTab, CoverageTabs } from "@/components/coverage/coverage-tabs";
import { StatCell } from "@/components/coverage/stat-cell";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { dateFormat, numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

type SiteUsage = Awaited<ReturnType<typeof unicum.usage.site>>;
type ModUsage = Awaited<ReturnType<typeof unicum.usage.mod>>;
type BotUsage = Awaited<ReturnType<typeof unicum.usage.bot>>;

/**
 * The coverage page's Usage tab: how many people use the site, read from our
 * own records. Analytics already says how many pages were opened; what it
 * cannot say is how many accounts exist and how many of them come back, which
 * is what an open-source project owes the people deciding whether to rely on
 * it.
 *
 * The mod and the bot each have their own panel on their own page, where a
 * reader deciding whether to install one is standing; this tab carries one line
 * of each and the way there.
 */
export async function SiteUsageView({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const { t } = await getTranslation("components/usage/site-usage-view", locale);
  const [site, mod, bot] = await Promise.all([
    buildSafe<SiteUsage | null>(() => unicum.usage.site(), null),
    buildSafe<ModUsage | null>(() => unicum.usage.mod(), null),
    buildSafe<BotUsage | null>(() => unicum.usage.bot(), null),
  ]);
  if (!site) return null;
  const n = (value: number) => numberFormat(locale, INT_FORMAT).format(value);
  const since = dateFormat(locale, "d MMMM yyyy").format(
    new Date(`${site.activeRecordedSince}T00:00:00Z`),
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("hero")}
              values={{
                accounts: <span className="text-brand">{n(site.accounts)}</span>,
                active: <span className="text-brand">{n(site.active.month)}</span>,
              }}
            />
          </h1>
          <p className="mt-4 text-fd-muted-foreground">
            {t("subtitle")}{" "}
            <a href={APP.EXTERNAL.GITHUB} className="underline-offset-2 hover:underline">
              {t("code-on-github")}
            </a>
            .
          </p>
        </PanelContent>
      </Panel>

      <CoverageTabs region={region} locale={locale} active={CoverageTab.Usage} />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("accounts")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCell label={t("accounts")} value={n(site.accounts)} />
            <StatCell label={t("active-today")} value={n(site.active.day)} />
            <StatCell label={t("active-week")} value={n(site.active.week)} />
            <StatCell label={t("active-month")} value={n(site.active.month)} />
            <StatCell label={t("linked-discord")} value={n(site.linked.discord)} />
            <StatCell label={t("linked-twitch")} value={n(site.linked.twitch)} />
            <StatCell
              label={t("supporters")}
              value={
                <Link href={ROUTES.SUPPORT} className="underline-offset-2 hover:underline">
                  {n(site.supporters)}
                </Link>
              }
            />
          </div>
          <p className="text-xs text-fd-muted-foreground">{t("signed-in-only")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("trends-last-30-days")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CoverageAreaChart
              title={t("signups")}
              data={site.signupsDaily}
              ariaLabel={t("signups-last-30-days")}
              defaultMode={ChartMode.Cumulative}
              total={site.accounts}
            />
            <CoverageAreaChart
              title={t("active-readers")}
              data={site.activeDaily}
              ariaLabel={t("active-readers-last-30-days")}
              allowCumulative={false}
            />
          </div>
          <p className="text-xs text-fd-muted-foreground">
            {t("activity-recorded-since", { date: since })}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("mod-and-bot")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {mod && (
            <StatCell
              label={t("mod-users")}
              value={
                <Link href={ROUTES.MOD} className="underline-offset-2 hover:underline">
                  {t("mod-line", { users: n(mod.users), battles: n(mod.battles) })}
                </Link>
              }
            />
          )}
          {bot && bot.guilds !== null && (
            <StatCell
              label={t("bot-servers")}
              value={
                <Link href={ROUTES.BOT} className="underline-offset-2 hover:underline">
                  {t("bot-line", {
                    servers: n(bot.guilds),
                    commands: n(bot.commandsMonth),
                  })}
                </Link>
              }
            />
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
