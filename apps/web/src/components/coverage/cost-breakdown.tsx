const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export type InfraCosts = {
  totalAnnualUsd: number;
  breakdown: { label: string; usdAnnual: number; note?: string }[];
};

/**
 * The infrastructure cost story: annual total, monthly run rate and the
 * per-line breakdown. Shared by the coverage page (full transparency) and the
 * support page (the reason we ask for help).
 */
export function CostBreakdown({ costs }: { costs: InfraCosts }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          Estimated annual cost
        </div>
        <div className="font-heading text-4xl font-bold tabular-nums text-brand">
          {usdFmt.format(costs.totalAnnualUsd)}
        </div>
        <div className="text-sm text-fd-muted-foreground">
          A fixed {usdFmt.format(costs.totalAnnualUsd / 12)}/month bill, no
          surprises: one OVH VPS, no third-party SaaS in the data path. It only
          grows when we outgrow the server (more Wargaming throughput means more
          egress IPs).
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          Cost breakdown
        </div>
        <ul className="divide-y divide-fd-border text-sm">
          {costs.breakdown.map((line) => (
            <li
              key={line.label}
              className="flex items-start justify-between gap-4 py-2"
            >
              <span>
                <span className="text-fd-foreground">{line.label}</span>
                {line.note && (
                  <span className="block text-xs text-fd-muted-foreground">
                    {line.note}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                {line.usdAnnual > 0 ? usdFmt.format(line.usdAnnual) : "free"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
