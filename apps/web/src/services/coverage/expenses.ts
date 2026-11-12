import { buildExpenseLedger, env, type ExpenseLedger } from "@unicum.gg/shared";

// Additional egress IPs = the distinct Wargaming egress targets we route through
// minus the one primary IP included with the VPS. Derived from env so the cost
// tracks reality automatically as we add or drop IPs (WG_EGRESS_* holds one
// entry per egress path; see packages/core wargaming/client).
const ADDITIONAL_EGRESS_IPS = Math.max(
  0,
  new Set(
    [env.WG_EGRESS_EU, env.WG_EGRESS_NA, env.WG_EGRESS_ASIA]
      .flatMap((v) => v?.split(",") ?? [])
      .map((s) => s.trim())
      .filter(Boolean),
  ).size - 1,
);

const EXPENSES = buildExpenseLedger(ADDITIONAL_EGRESS_IPS);

/**
 * What the site costs, in euros (the currency every one of these is invoiced
 * in). A pure constant-derived figure (no DB), so the funding endpoint and the
 * top-bar mini bar can use it cheaply on every request without touching the
 * heavy coverage query.
 */
export function getExpenseLedger(): ExpenseLedger {
  return EXPENSES;
}
