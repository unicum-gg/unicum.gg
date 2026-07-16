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
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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
  if (rows.length === 0) return <p>No contribution.</p>;
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <div key={r.tier} className="flex justify-between gap-3 tabular-nums">
          <span>
            Tier {toRoman(r.tier)}: {r.count} × {money(r.unit)}
          </span>
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
export function ValueTab({
  region,
  nickname,
  valuation,
}: {
  region: Region;
  nickname: string;
  valuation: PlayerValuation;
}) {
  const fmt = moneyFmt(region);
  const money = (n: number) => (fmt ? fmt.format(n) : `~${n.toFixed(0)}`);
  const { market, account } = valuation;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s account value</PanelTitle>
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
                  <h3 className="font-semibold">Market value</h3>
                  <p className="text-xs text-fd-muted-foreground">
                    Estimated worth of the account on the second-hand market
                  </p>
                </div>
              </div>
              <div className="font-heading text-4xl font-bold text-fd-primary">
                {money(market.amount)}
              </div>
              <div className="space-y-1 border-t border-fd-border pt-3">
                <Row
                  label="Reward tanks"
                  hint={`× ${market.rewardCount}`}
                  value={money(market.rewards)}
                  tip={
                    <div className="space-y-1.5 text-xs">
                      <p className="opacity-70">
                        Reward tanks are valued by tier (the market&apos;s
                        biggest driver: rare campaign and collector tanks).
                      </p>
                      <TierLines rows={market.rewardsByTier} money={money} />
                    </div>
                  }
                />
                <Row
                  label="Marks of Excellence"
                  hint={
                    market.mark3Count
                      ? `${market.mark3Count}× 3 marks`
                      : undefined
                  }
                  value={money(market.marks)}
                  tip={
                    <div className="space-y-1.5 text-xs">
                      <p className="opacity-70">
                        Marks weighted by tier (3-marking a tier X is far harder
                        than a tier V). 3 marks = €2.5 × tier, 2 marks = €0.6 ×
                        tier.
                      </p>
                      {market.marks3ByTier.length > 0 && (
                        <div>
                          <p className="font-medium">3 marks</p>
                          <TierLines rows={market.marks3ByTier} money={money} />
                        </div>
                      )}
                      {market.marks2ByTier.length > 0 && (
                        <div>
                          <p className="font-medium">2 marks</p>
                          <TierLines rows={market.marks2ByTier} money={money} />
                        </div>
                      )}
                    </div>
                  }
                />
                <Row
                  label="Tier X + premiums"
                  hint={`${market.tierXCount} + ${market.premiumCount}`}
                  value={money(market.base + market.tierX + market.premiums)}
                  tip={
                    <div className="space-y-0.5 text-xs tabular-nums">
                      <div className="flex justify-between gap-3">
                        <span>Base account</span>
                        <span>{money(market.base)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>{market.tierXCount} tier X × €2.5</span>
                        <span>{money(market.tierX)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>{market.premiumCount} premiums × €0.7</span>
                        <span>{money(market.premiums)}</span>
                      </div>
                    </div>
                  }
                />
                <Row label="Subtotal" value={money(market.subtotal)} strong />
                <Row
                  label="Skill multiplier"
                  hint={
                    market.wn8 != null
                      ? `WN8 ${intFmt.format(market.wn8)}${market.statConfidence < 1 ? `, ${Math.round(market.statConfidence * 100)}% proven` : ""}`
                      : "no WN8"
                  }
                  value={`× ${market.statMultiplier.toFixed(2)}`}
                  tip={
                    <div className="space-y-1 text-xs opacity-80">
                      <p>
                        A WN8-based multiplier on the whole account: a strong
                        account is worth multiples of the same garage played
                        badly.
                      </p>
                      {market.statConfidence < 1 && (
                        <p>
                          Only {Math.round(market.statConfidence * 100)}% applied:
                          the stats aren&apos;t proven yet over{" "}
                          {intFmt.format(market.battles)} battles (full trust at
                          10,000).
                        </p>
                      )}
                    </div>
                  }
                />
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
                <h3 className="font-semibold">Rebuild value</h3>
                <p className="text-xs text-fd-muted-foreground">
                  Cost to reach the same garage through the in-game store
                </p>
              </div>
            </div>
            <div className="font-heading text-4xl font-bold text-fd-foreground">
              {account ? money(account.amount) : "—"}
            </div>
            <p className={styles.mutedDescription}>
              The real-money cost to research (free XP) and buy every tank on the
              account, premiums priced in gold. Far higher than the market value:
              the market barely pays for grind, only for what is rare or proven.
            </p>
            <div className="flex flex-wrap gap-4 border-t border-fd-border pt-3 text-sm">
              <span className="flex items-center gap-1.5 text-fd-muted-foreground">
                <TrophyIcon className="size-4 text-fd-primary" />
                {intFmt.format(market.rewardCount)} reward tanks
              </span>
              <span className="flex items-center gap-1.5 text-fd-muted-foreground">
                <MedalIcon className="size-4 text-[#E8B96A]" />
                {intFmt.format(market.mark3Count)} tanks 3-marked
              </span>
            </div>
          </section>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelContent className="px-4 py-4">
          <p className="text-xs leading-relaxed text-fd-muted-foreground">
            Indicative estimates only. The market value is modelled from prices
            of comparable accounts and is driven mostly by rare reward tanks,
            proven skill (WN8) and marks of excellence. Trading Wargaming
            accounts is against the game&apos;s terms of service; these figures
            are for reference and we do not facilitate any sale.
          </p>
        </PanelContent>
      </Panel>
    </>
  );
}
