import {
  CoinVerticalIcon,
  MedalIcon,
  StorefrontIcon,
  TrophyIcon,
} from "@phosphor-icons/react/dist/ssr";
import { type PlayerValuation, moneyFmt } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
      <span
        className={cn(
          "text-sm",
          strong ? "font-medium text-fd-foreground" : "text-fd-muted-foreground",
        )}
      >
        {label}
        {hint ? (
          <span className="ml-1 text-xs text-fd-muted-foreground">{hint}</span>
        ) : null}
      </span>
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

/**
 * The account's two estimated values, computed server-side (see the shared
 * `players/valuation` model): grey-market resale estimate (Market value) and
 * reconstruction cost through the store (Rebuild value).
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
          {/* Market value — the headline: what a comparable account trades for */}
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
              />
              <Row
                label="Marks of Excellence"
                hint={
                  market.mark3Count ? `${market.mark3Count}× 3 marks` : undefined
                }
                value={money(market.marks)}
              />
              <Row
                label="Tier X + premiums"
                hint={`${market.tierXCount} + ${market.premiumCount}`}
                value={money(market.base + market.tierX + market.premiums)}
              />
              <Row label="Subtotal" value={money(market.subtotal)} strong />
              <Row
                label="Skill multiplier"
                hint={`WN8-based${market.statConfidence < 1 ? `, ${Math.round(market.statConfidence * 100)}% proven` : ""}`}
                value={`× ${market.statMultiplier.toFixed(2)}`}
              />
            </div>
          </section>

          {/* Account value — reconstruction cost through the store */}
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
