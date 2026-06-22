# Ad revenue model vs flat hosting cost (UNI-39 Deliverable B)

Margin proof for the `<AdSlot>` rollout, reconciled with the CMO economic model (UNI-47)
and live GSC reach data. Both company metrics must hold: grow MAU AND keep monthly
contribution margin above zero.

## The decision that matters: network, not geometry

The placement plan is 100% AdSense and the CEO confirmed AdSense fill/RPM is near-zero.
**AdSense-only is a near-zero revenue ceiling.** The dominant revenue lever is the ad
*network*: a gaming-vertical network (Ezoic now, Playwire/Snigel at scale) delivers 3-5x
raw AdSense RPM. At tomato.gg-scale traffic that is a ~$3.75k vs ~$25k/mo swing.

This is why `<AdSlot>` is **network-agnostic** (see `src/components/ad/ad-network.ts`): the
unit markup + activation live behind a per-network adapter and the active network is an env
flag (`NEXT_PUBLIC_AD_NETWORK`, default `adsense`). Moving AdSense -> Ezoic -> Playwire is
adding an adapter and flipping the flag, never an AdSlot rewrite. We do not pour engineering
into AdSense-specific plumbing that cannot be repointed.

Network roadmap (CMO, sequenced): (1) now, low volume - apply to Ezoic (no traffic minimum,
~2-3x AdSense), AdSense stays fallback; (2) at 50k+ sessions/mo - Playwire/Snigel (gaming
header bidding, $6-12 on tool/tank pages).

## Cost side: flat

- Hosting is a single OVH VPS, FIXED at ~EUR 20-40/mo (~$22-44/mo). It does not scale with
  pageviews.
- Ad JS (AdSense or a mediation network) serves from the network's CDN, not our VPS. Each
  ad-served pageview adds ~$0 marginal infra cost and does not move the single-box saturation
  point (driven by per-second crons x3 regions + WG fetch + SSR, not ad markup).
- So margin = ad revenue - ~flat cost, scaling near-linearly with traffic above break-even.
  The real risk is not infra cost: it is a CWV/CLS regression eroding the SEO that produces
  the pageviews. That is why `<AdSlot>` enforces reserved space (CLS ~0) + lazy-load (LCP).

## RPM bands (CMO, validated gaming display 2026)

| Page type | Gaming-network RPM | Raw AdSense RPM | Live today? |
|---|---|---|---|
| Thin player profile | $1-4 | ~$0.30-1.00 | yes (2.34M pages) |
| Leaderboard / clan listing | $2-5 | ~$0.50-1.50 | yes |
| Tank / comparison / tool / guide | $6-12 | ~$1.50-3 | NO (UNI-19, PR #5 unmerged) |
| Blended near-term (profiles dominate volume) | ~$2-4 | ~$0.50-1.00 | - |

Profiles are the volume engine but the lowest RPM band. Tank pages are the highest band and
unlock the upside; sequence ad value to follow high-RPM content as it ships.

## Break-even vs hosting

Break-even pageviews/mo = cost / RPM x 1000:

| RPM scenario | pv/mo to cover $22 | pv/mo to cover $44 |
|---|---|---|
| AdSense $0.75 | ~29,000 | ~59,000 |
| Network $3 | ~7,300 | ~14,700 |
| Network+tank $6 | ~3,700 | ~7,300 |

The network choice decides whether ads merely cover the VPS or fund real margin.

## Scenario monthly ad revenue (blended RPM x pageviews)

| Pageviews/mo | AdSense $0.75 | Network $3 | Network+tank $5 |
|---|---|---|---|
| 50k | $38 | $150 | $250 |
| 200k | $150 | $600 | $1,000 |
| 500k | $375 | $1,500 | $2,500 |
| 1M | $750 | $3,000 | $5,000 |
| 5M (~tomato.gg scale) | $3,750 | $15,000 | $25,000 |

## Live reach reconciliation (GSC, 28d, sc-domain:unicum.gg)

The "pending Umami pageviews" open input is now resolved enough to finalize the verdict using
real organic data the CMO pulled from GSC:

| Metric (28d) | Value |
|---|---|
| Impressions | 941 |
| Clicks | 7 |
| Avg CTR | 0.74% |
| Avg position | 9.9 |

Reach is pure long-tail (individual player/clan profiles, 1-5 impressions each, homepage 21).
Tank pages contribute 0 (highest-RPM band not live in reach terms either). Even at a generous
10-20x clicks-to-total-pageviews multiple, we are **2-3 orders of magnitude below the lowest
break-even floor (~3,700 pv/mo)**.

## Day-one verdict (finalized)

1. **Ship the units dark now.** Flat VPS cost, ~$0 marginal per ad-served pageview, and they
   light up via one env flip (`NEXT_PUBLIC_ADS_ENABLED=true` after UNI-43 delivers slot ids).
   No downside while reach is small; the CWV guard bounds the only real risk.
2. **Ad revenue is ~$0 until reach grows. Ad infrastructure is not the binding constraint on
   margin right now - reach is.** The monetization layer is being built ahead of the traffic
   that makes it pay; that is correct only if reach ships in parallel.
3. **Highest-leverage merge for the twin metrics is PR #5 (tank pages, UNI-19):** the #1 reach
   surface AND the highest-RPM ad band. The ad PR (#12) and Discord are margin-safe dark and
   lower urgency than the reach lever.
4. **When network is chosen:** apply to Ezoic immediately (it lifts RPM 2-3x at any volume);
   AdSlot already supports the swap with no code change beyond the adapter.

Precise total-channel pv (Umami 30-day) remains a refinement, not a blocker: the GSC organic
floor above is decisive, and Umami would only refine the exact denominator, not the conclusion.
UNI-46 owns the post-deploy fill/RPM + pv reconcile against these tables once ads are live.
