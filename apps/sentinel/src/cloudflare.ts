/**
 * Turning the site's challenge rule on and off.
 *
 * The rule itself is not written here and never changes: it is the one that has
 * been live since the scraper attack, challenging every HTML page except the
 * API, the assets and Cloudflare's own verified bots. What this file owns is its
 * `enabled` flag, nothing else, which is why the token it uses is scoped to
 * exactly one permission on exactly one zone.
 *
 * Why a switch rather than a better rule: the attack came through distributed
 * proxies, so every address stayed under any sane per-address threshold and only
 * the aggregate was large. Cloudflare's free plan counts per address and nothing
 * else, so it can never see that shape. The aggregate is visible from here and
 * nowhere else, which is what puts the decision on our side of the wire.
 */
const API = "https://api.cloudflare.com/client/v4";

export type RuleConfig = {
  token: string;
  zoneId: string;
  rulesetId: string;
  ruleId: string;
};

type Rule = {
  id: string;
  enabled?: boolean;
  action: string;
  expression: string;
  description?: string;
};

async function cf(cfg: RuleConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as {
    success: boolean;
    result?: unknown;
    errors?: Array<{ message?: string }>;
  };
  if (!body.success) {
    const why = (body.errors ?? []).map((e) => e.message).join("; ");
    throw new Error(`cloudflare ${path}: ${why || res.status}`);
  }
  return body.result;
}

/** The rule as Cloudflare currently holds it. */
export async function readRule(cfg: RuleConfig): Promise<Rule> {
  const ruleset = (await cf(cfg, `/zones/${cfg.zoneId}/rulesets/${cfg.rulesetId}`)) as {
    rules?: Rule[];
  };
  const rule = (ruleset.rules ?? []).find((r) => r.id === cfg.ruleId);
  if (!rule) throw new Error(`rule ${cfg.ruleId} not found in ruleset`);
  return rule;
}

/**
 * Set the rule's enabled flag, and return whether anything changed.
 *
 * Reads before it writes rather than remembering what it last set, because the
 * truth lives at Cloudflare: somebody can flip this rule in the dashboard, and a
 * sentinel that trusted its own memory would either fight them or sit on a stale
 * belief for as long as it runs. The whole rule is sent back because the API
 * replaces what it is given, so a partial write would quietly drop the
 * expression that is the entire point of the rule.
 */
export async function setRuleEnabled(
  cfg: RuleConfig,
  enabled: boolean,
): Promise<boolean> {
  const rule = await readRule(cfg);
  if ((rule.enabled ?? true) === enabled) return false;
  await cf(cfg, `/zones/${cfg.zoneId}/rulesets/${cfg.rulesetId}/rules/${cfg.ruleId}`, {
    method: "PATCH",
    body: JSON.stringify({
      action: rule.action,
      expression: rule.expression,
      description: rule.description ?? "",
      enabled,
    }),
  });
  return true;
}
