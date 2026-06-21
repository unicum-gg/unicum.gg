# Ad revenue model vs flat hosting cost (UNI-39 Deliverable B)

Margin proof for the `<AdSlot>` rollout. The question is not "can ads pay for a CDN bill"
(the ad JS is served from Google's CDN, not our VPS) but "at what monthly traffic does
display revenue clear the flat OVH cost." Both company metrics must hold: grow MAU AND
keep monthly contribution margin above zero.

## Cost side: flat

- Hosting is a single OVH VPS, FIXED at roughly EUR 20-40/mo (~$22-44/mo, CEO to confirm
  invoice). It does not scale with pageviews.
- AdSense client JS (`adsbygoogle.js`) loads from Google's CDN and renders client-side.
  Each ad-served pageview adds about $0 of marginal infra cost on our box and does not move
  the single-box saturation point (which is driven by per-second crons x3 regions + WG
  fetch + SSR, not by serving ad markup).
- Therefore margin = ad revenue - ~flat cost, and margin scales close to linearly with
  traffic once break-even is crossed. The real risk is not infra cost: it is a CWV/CLS
  regression eroding the SEO that produces the pageviews. That is exactly why `<AdSlot>`
  centralizes reserved space (CLS ~0) and IntersectionObserver lazy-load (LCP protection).

## Revenue side: page RPM x pageviews

Formula: `monthly revenue = (pageviews / 1000) x blended page RPM`.

Blended page RPM uses the indexable-URL geo split as a proxy (~75% EU / 15% NA / 10%
Asia, from the EU 71 / NA 14 / Asia 10 sitemap player-chunk split):

- NA display RPM ~$6-12
- EU display RPM ~$2-5 (depressed by Consent Mode v2 denied-by-default)
- Asia/CIS display RPM ~$0.5-2

That blend lands a conservative-to-optimistic page RPM band of roughly $2.00-$6.00.
Ezoic / Playwire mediation (UNI-18 scope) is modeled as a 1.5-2x upside, NOT baseline.
Baseline assumes current AdSense fill/RPM ~0 today; this models EXPECTED yield once real
`data-ad-slot` ids are placed (UNI-43).

| Scenario     | Blended page RPM | Monthly cost | Break-even pageviews/mo |
|--------------|------------------|--------------|-------------------------|
| Conservative | $2.00            | $44          | ~22,000                 |
| Mid          | $3.50            | $33          | ~9,400                  |
| Optimistic   | $6.00            | $22          | ~3,700                  |

Every pageview above the break-even row is pure contribution margin.

## Day-one verdict

Ship all placements regardless of current traffic. Rationale:

1. Cost is flat and marginal infra cost per ad-served pageview is ~0, so ads can only add
   contribution margin, never subtract it (the downside is bounded by the CWV guard, which
   `<AdSlot>` enforces).
2. The reach engine is ~2.4M indexable player/clan URLs still ramping in the index. Even if
   current pageviews sit below the conservative ~22k/mo break-even, the crossover arrives as
   organic traffic ramps; placing units now means we capture margin the moment it does.
3. Decision rule (per UNI-39): if live 30-day pageviews already exceed ~22k/mo, we are
   margin-positive day one even at the conservative $2.00 RPM. If below, still ship (flat
   cost) and track the ramp toward the mid ~9.4k and conservative ~22k thresholds.

## Open input (does NOT block the build)

The one number this model still needs plugged in is the live trailing-30-day pageview count
per region from Umami (`cloud.umami.is`). It is not accessible from the CTO agent environment
(no Umami credentials injected; SEO Gets has no unicum.gg property), so it is routed to the
board / CMO. Once provided, drop it into the decision rule above to state which break-even row
we are already past. The placement build (UNI-40/41/42) does not wait on it.
