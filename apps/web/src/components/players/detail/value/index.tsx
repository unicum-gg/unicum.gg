import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import {
  CoinVerticalIcon,
  MedalIcon,
  StorefrontIcon,
  TrophyIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toRoman } from "roman-numerals";
import {
  type PlayerValuation,
  type TierContribution,
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
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** One breakdown line; `tip` (if given) shows the calculation on hover. */
function Row({
  label,
  value,
  hint,
  strong,
  tip,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tip?: React.ReactNode;
}) {
  const left = (
    <span
      className={cn(
        "text-sm",
        strong ? "font-medium text-fd-foreground" : "text-fd-muted-foreground",
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
      <span
        className={cn(
          "text-sm tabular-nums",
          strong ? "font-semibold text-fd-foreground" : "text-fd-foreground/85",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Renders "Tier X: 5 × €150 = €750" lines for a per-tier contribution list. */
function TierLines({
  rows,
  money,
}: {
  rows: TierContribution[];
  money: (n: number) => string;
}) {
  const { t } = useTranslation("components/players/detail/value/index");
  if (rows.length === 0) return <p>{t("no-contribution")}</p>;
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <div key={r.tier} className="flex justify-between gap-3 tabular-nums">
          <span>
            {t("tier", { tier: toRoman(r.tier), count: r.count, unit: money(r.unit) })}</span>
          <span className="font-medium">{money(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The account's two estimated values, computed server-side (see the shared
 * `players/valuation` model): grey-market resale estimate (Market value) and
 * reconstruction cost through the store (Rebuild value). Each market line
 * spells out its calculation on hover.
 */
export function ValueTab(
  props:
    | { loading: true; nickname: string }
    | { region: Region; nickname: string; valuation: PlayerValuation },
) {
  const { locale } = useLocale();
  const { t: tCopy } = useTranslation("components/players/detail/value/index");
  const { t } = useTranslation("components/players/detail/value/index");
  if ("loading" in props) {
    return <ValueTabSkeleton nickname={props.nickname} />;
  }

  const { region, nickname, valuation } = props;
  const fmt = moneyFmt(region);
  const money = (n: number) => (fmt ? fmt.format(n) : `~${n.toFixed(0)}`);
  const { market, account } = valuation;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("account-value", { nickname })}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 md:grid-cols-2">
          {/* Market value: the headline, what a comparable account trades for */}
          <TooltipProvider delayDuration={100}>
            <section className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <StorefrontIcon
                  weight="duotone"
                  className="size-6 text-fd-primary"
                />
                <div>
                  <h3 className="font-semibold">{t("market-value")}</h3>
                  <p className="text-xs text-fd-muted-foreground">
                    {t("estimated-worth-of-the-account")}</p>
                </div>
              </div>
              <div className="font-heading text-4xl font-bold text-fd-primary">
                {money(market.amount)}
              </div>
              <div className="space-y-1 border-t border-fd-border pt-3">
                <Row
                  label={t("reward-tanks-label")}
                  hint={`× ${market.rewardCount}`}
                  value={money(market.rewards)}
                  tip={
                    <div className="space-y-1.5 text-xs">
                      <p className="opacity-70">
                        {t("reward-tanks-add-a-little")}</p>
                      <TierLines rows={market.rewardsByTier} money={money} />
                    </div>
                  }
                />
                <Row
                  label={t("marks-of-excellence")}
                  hint={
                    market.mark3Count
                      ? t("n-three-mark-guns", { count: market.mark3Count })
                      : undefined
                  }
                  value={money(market.marks)}
                  tip={
                    <div className="space-y-1.5 text-xs">
                      <p className="opacity-70">
                        {t("marks-weighted-by-tier-3")}</p>
                      {market.marks3ByTier.length > 0 && (
                        <div>
                          <p className="font-medium">{tCopy("3-marks")}</p>
                          <TierLines rows={market.marks3ByTier} money={money} />
                        </div>
                      )}
                      {market.marks2ByTier.length > 0 && (
                        <div>
                          <p className="font-medium">{tCopy("2-marks")}</p>
                          <TierLines rows={market.marks2ByTier} money={money} />
                        </div>
                      )}
                    </div>
                  }
                />
                <Row
                  label={t("tier-x-premiums")}
                  hint={`${market.tierXCount} + ${market.premiumCount}`}
                  value={money(market.tierX + market.premiums)}
                  tip={
                    <div className="space-y-0.5 text-xs tabular-nums">
                      <div className="flex justify-between gap-3">
                        <span>{t("tier-x-0-25", { tierXCount: market.tierXCount })}</span>
                        <span>{money(market.tierX)}</span>
                      </div>
                      <div className="flex justify-between gap-3 opacity-70">
                        <span>{t("premiums-by-tier", { premiumCount: market.premiumCount })}</span>
                        <span>{money(market.premiums)}</span>
                      </div>
                      <TierLines rows={market.premiumsByTier} money={money} />
                    </div>
                  }
                />
                <Row label={t("garage-subtotal")} value={money(market.content)} strong />
                <Row
                  label={t("skill-premium")}
                  hint={`WGR ${numberFormat(locale, INT_FORMAT).format(market.wgr)}`}
                  value={`+ ${money(market.skillPremium)}`}
                  tip={
                    <div className="space-y-1 text-xs opacity-80">
                      <p>
                        {t("the-real-driver-based-on")}</p>
                    </div>
                  }
                />
                {market.depthBonus > 0 && (
                  <Row
                    label={t("depth-bonus")}
                    hint={`${numberFormat(locale, INT_FORMAT).format(market.battles)} battles`}
                    value={`+ ${money(market.depthBonus)}`}
                    tip={
                      <div className="text-xs opacity-80">
                        {t("an-exceptional-battle-count-is")}</div>
                    }
                  />
                )}
              </div>
            </section>
          </TooltipProvider>

          {/* Account value: reconstruction cost through the store */}
          <section className="space-y-3 p-6">
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
            <div className="font-heading text-4xl font-bold text-fd-foreground">
              {account ? money(account.amount) : "—"}
            </div>
            <p className={styles.mutedDescription}>
              {t("the-real-money-cost-to")}</p>
            <div className="flex flex-wrap gap-4 border-t border-fd-border pt-3 text-sm">
              <span className="flex items-center gap-1.5 text-fd-muted-foreground">
                <TrophyIcon className="size-4 text-fd-primary" />
                {t("reward-tanks-count", {
                  count: numberFormat(locale, INT_FORMAT).format(market.rewardCount),
                })}
              </span>
              <span className="flex items-center gap-1.5 text-fd-muted-foreground">
                <MedalIcon className="size-4 text-[#E8B96A]" />
                {t("tanks-3-marked", {
                  count: numberFormat(locale, INT_FORMAT).format(market.mark3Count),
                })}
              </span>
            </div>
          </section>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelContent className="px-4 py-4">
          <p className="text-xs leading-relaxed text-fd-muted-foreground">
            {t("indicative-estimates-only-the-market")}</p>
        </PanelContent>
      </Panel>
    </>
  );
}

/** The loading twin: same panels + real title, the two valuation columns and the
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
        <PanelContent className="grid gap-px p-0 md:grid-cols-2">
          {(["market", "rebuild"] as const).map((col) => (
            <section key={col} className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-md" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-10 w-40" />
              {col === "market" ? (
                <div className="space-y-2.5 border-t border-fd-border pt-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className={`space-y-1.5 ${styles.mutedDescription}`}>
                    <Skeleton className="h-3 w-full max-w-md" />
                    <Skeleton className="h-3 w-full max-w-sm" />
                    <Skeleton className="h-3 w-2/3 max-w-xs" />
                  </div>
                  <div className="flex flex-wrap gap-4 border-t border-fd-border pt-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </>
              )}
            </section>
          ))}
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
