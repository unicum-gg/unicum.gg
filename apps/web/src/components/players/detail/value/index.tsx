import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { CoinVerticalIcon } from "@phosphor-icons/react/dist/ssr";
import {
  CREDITS_PER_GOLD,
  XP_PER_GOLD,
  type PlayerTankRow,
  type PlayerValuation,
  type RebuildLine,
  moneyFmt,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TankCostsTable } from "@/components/players/detail/value/tank-costs";
import { COSTS_SKELETON_COLUMNS } from "@/components/players/detail/value/skeleton-columns";
import { TableSkeleton } from "@/components/table-skeleton";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** One breakdown line; `tip` (if given) spells out the calculation on hover. */
function Row({
  label,
  value,
  hint,
  tip,
}: {
  label: string;
  value: string;
  hint?: string;
  tip?: React.ReactNode;
}) {
  const left = (
    <span
      className={cn(
        "text-sm text-fd-muted-foreground",
        tip && "cursor-help decoration-dotted underline-offset-4 hover:underline",
      )}
    >
      {label}
      {hint ? (
        <span className="ml-1 text-xs text-fd-muted-foreground">{hint}</span>
      ) : null}
    </span>
  );
  return (
    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
      {tip ? (
        <Tooltip>
          <TooltipTrigger asChild>{left}</TooltipTrigger>
          <TooltipContent className="max-w-xs">{tip}</TooltipContent>
        </Tooltip>
      ) : (
        left
      )}
      <span className="mx-2 mb-1 flex-1 border-b border-dotted border-fd-border" />
      <span className="text-sm tabular-nums text-fd-foreground/85">{value}</span>
    </div>
  );
}

/**
 * What the account's garage would cost to put together again through the
 * official store, computed server-side (see the shared `players/valuation`
 * model), broken into the three things actually paid for.
 */
export function ValueTab(
  props:
    | { loading: true; nickname: string }
    | {
        region: Region;
        nickname: string;
        valuation: PlayerValuation;
        /** The garage behind the total, for the per-vehicle table. Loaded from
         * the tanks endpoint when this tab opens, like the Tanks tab does, so
         * the detail payload stays free of a 500-row list only this table
         * reads. Empty while it is in flight. */
        vehicles: PlayerTankRow[];
        vehiclesLoading: boolean;
      },
) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/detail/value/index");
  if ("loading" in props) {
    return <ValueTabSkeleton nickname={props.nickname} />;
  }

  const { region, nickname, valuation, vehicles, vehiclesLoading } = props;
  const fmt = moneyFmt(region, locale);
  const money = (n: number) => (fmt ? fmt.format(n) : `~${n.toFixed(0)}`);
  const { account } = valuation;
  const num = (n: number) => numberFormat(locale, INT_FORMAT).format(n);
  const breakdown = account?.breakdown;

  // Each line's own tooltip: how many vehicles it pays for, and the game's own
  // rate that turns its currency into the gold the store actually sells.
  const lineTip = (line: RebuildLine, body: string) => (
    <div className="space-y-1 text-xs">
      <p className="opacity-80">{body}</p>
      <p className="tabular-nums opacity-70">
        {t("that-is-n-gold", { gold: num(line.gold) })}
      </p>
    </div>
  );

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("account-value", { nickname })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <TooltipProvider delayDuration={100}>
            {/* One column since the market estimate was removed, so the content
                carries its own measure: a dotted leader spanning a desktop
                screen is unreadable, and so is prose at that line length. */}
            <section className="max-w-2xl space-y-3 p-6">
              <div className="flex items-center gap-2">
                <CoinVerticalIcon
                  weight="duotone"
                  className="size-6 text-[#F2D45C]"
                />
                <div>
                  <h3 className="font-semibold">{t("rebuild-value")}</h3>
                  <p className="text-xs text-fd-muted-foreground">
                    {t("cost-to-reach-the-same")}</p>
                </div>
              </div>
              <div>
                <div className="font-heading text-4xl font-bold text-fd-foreground">
                  {account ? money(account.amount) : "—"}
                </div>
                {breakdown && (
                  <p className="mt-1 text-sm tabular-nums text-fd-muted-foreground">
                    {t("n-gold-in-total", { gold: num(breakdown.gold) })}
                  </p>
                )}
              </div>
              {/* Absent only while a payload cached under the previous shape is
                  still being served (60s at most), where the total stands on
                  its own exactly as it did before. */}
              {breakdown && (
                <div className="space-y-1 border-t border-fd-border pt-3">
                  <Row
                    label={t("research-label")}
                    hint={t("n-free-xp", {
                      units: num(breakdown.research.units),
                    })}
                    value={money(breakdown.research.amount)}
                    tip={lineTip(
                      breakdown.research,
                      t("researched-with-free-xp", {
                        count: num(breakdown.research.count),
                        rate: XP_PER_GOLD,
                      }),
                    )}
                  />
                  <Row
                    label={t("purchase-label")}
                    hint={t("n-credits", {
                      units: num(breakdown.credits.units),
                    })}
                    value={money(breakdown.credits.amount)}
                    tip={lineTip(
                      breakdown.credits,
                      t("bought-with-credits", {
                        count: num(breakdown.credits.count),
                        rate: CREDITS_PER_GOLD,
                      }),
                    )}
                  />
                  <Row
                    label={t("premiums-label")}
                    hint={t("n-gold", { units: num(breakdown.premiums.units) })}
                    value={money(breakdown.premiums.amount)}
                    tip={lineTip(
                      breakdown.premiums,
                      t("already-priced-in-gold", {
                        count: num(breakdown.premiums.count),
                      }),
                    )}
                  />
                </div>
              )}
              <p className={styles.mutedDescription}>
                {t("the-real-money-cost-to-research")}</p>
            </section>
          </TooltipProvider>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelContent className="px-4 py-4">
          <p className="text-xs leading-relaxed text-fd-muted-foreground">
            {t("an-indicative-estimate-only-store")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("every-tank-and-what-it")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {vehiclesLoading ? (
            <TableSkeleton rail columns={COSTS_SKELETON_COLUMNS} rows={10} />
          ) : (
            <TankCostsTable
              region={region}
              nickname={nickname}
              vehicles={vehicles}
            />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}

/** The loading twin: same panels + real title, the rebuild column and the
 * disclaimer rendered as placeholders. */
function ValueTabSkeleton({ nickname }: { nickname: string }) {
  const { t } = useTranslation("components/players/detail/value/index");
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("account-value", { nickname })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <section className="max-w-2xl space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2.5 border-t border-fd-border pt-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-2"
                >
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
            <div className={`space-y-1.5 ${styles.mutedDescription}`}>
              <Skeleton className="h-3 w-full max-w-md" />
              <Skeleton className="h-3 w-2/3 max-w-xs" />
            </div>
          </section>
        </PanelContent>
      </Panel>
      <PanelSeparator />
      <Panel>
        <PanelContent className="space-y-1.5 px-4 py-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </PanelContent>
      </Panel>
    </>
  );
}
