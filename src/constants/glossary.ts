/**
 * Definitional content for the metric glossary pages (`/glossary` and
 * `/glossary/<slug>`). These pages target high-intent definitional
 * searches ("what is wn8", "wn8 vs wnx", "wot personal rating") that the
 * profile pages reference on every visit but never explain. Content is
 * static and region-less: a rating definition is identical across EU, NA
 * and Asia, so a single set of pages serves every market.
 *
 * Keep this purely descriptive. Exact numeric colour thresholds live with
 * the rating helpers in `@/services/wargaming/wot/ratings`; restating them
 * here would risk drift, so the bands below stay qualitative and point the
 * reader at the on-site rating scale instead.
 */

export type GlossaryFaq = {
  question: string;
  answer: string;
};

export type GlossaryMetric = {
  slug: string;
  shortName: string;
  title: string;
  tagline: string;
  /** Used verbatim as the page meta description. Keep under ~160 chars. */
  summary: string;
  whatItMeasures: string;
  howItIsComputed: string;
  body: string[];
  faq: GlossaryFaq[];
  /** Slugs of sibling metrics surfaced in the "Related metrics" block. */
  relatedSlugs: string[];
};

export const GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    slug: "wn8",
    shortName: "WN8",
    title: "WN8 rating",
    tagline: "The community standard skill rating for World of Tanks.",
    summary:
      "WN8 is the community-standard World of Tanks skill rating. Learn what WN8 measures, how it is calculated from expected values, and how to read the colour bands.",
    whatItMeasures:
      "WN8 estimates a player's individual contribution per battle, independent of how many battles they have played. It rewards damage, kills, spotting, defence and winning beyond what an average player achieves in the same vehicles.",
    howItIsComputed:
      "WN8 compares your per-tank performance against an expected-values table maintained by the XVM project. For every tank you play, the formula weighs your average damage, frags, spots, defence points and win rate against the expected output for that tank, then aggregates across your garage. Wargaming does not return WN8 from its API, so unicum.gg computes it from your per-tank statistics and the latest expected-values table.",
    body: [
      "WN8 was designed to fix the main weakness of older ratings: rewarding sheer volume. A player with millions of low-impact battles should not outrank a sharper player with fewer games. By scoring each tank against what an average player does in that exact tank, WN8 isolates skill from grind.",
      "Because it is expected-value based, WN8 is sensitive to vehicle balance changes and to the expected-values table version. unicum.gg recomputes WN8 whenever a player's snapshot refreshes and tracks the table releases so your rating reflects the current meta rather than a frozen baseline.",
      "On unicum.gg, WN8 shares the same orange to green to cyan to purple colour scale as win rate, WN7 and WNX, so you can read all four at a glance. See the rating scale on the home page for the exact bands.",
    ],
    faq: [
      {
        question: "What is a good WN8 in World of Tanks?",
        answer:
          "Roughly, below 900 is below average, 900 to 1500 is average to above average, 1500 to 2450 is good to great, and above 2450 trends into unicum territory. The exact colour thresholds used on unicum.gg are shown on the home-page rating scale.",
      },
      {
        question: "Why does my WN8 differ between stats sites?",
        answer:
          "Different sites can use different expected-values table versions and refresh on different schedules. WN8 is a derived metric, not an official Wargaming number, so small differences across trackers are normal. unicum.gg recomputes it on every snapshot using the latest table.",
      },
      {
        question: "Is WN8 returned by the Wargaming API?",
        answer:
          "No. The public Wargaming API returns raw per-tank statistics but not WN8. unicum.gg computes WN8 from those raw stats and the XVM expected-values table.",
      },
    ],
    relatedSlugs: ["wnx", "wn7", "personal-rating"],
  },
  {
    slug: "wnx",
    shortName: "WNX",
    title: "WNX rating",
    tagline: "unicum.gg's signature skill rating, refined for the current meta.",
    summary:
      "WNX is the signature World of Tanks skill rating on unicum.gg. Learn what WNX measures, how it differs from WN8, and how to interpret the colour bands.",
    whatItMeasures:
      "WNX measures individual battle contribution like WN8, but is tuned on a fresher expected-values dataset so it tracks the live meta more closely. It is the default metric shown across unicum.gg.",
    howItIsComputed:
      "WNX uses the same expected-value philosophy as WN8: your per-tank damage, kills, spotting, defence and winning are scored against the expected output for each tank, then aggregated across your account. unicum.gg computes it server-side from your per-tank statistics, so no in-game login is required.",
    body: [
      "WNX exists because expected-value ratings are only as current as the table behind them. As Wargaming rebalances vehicles and introduces new ones, an old table slowly drifts out of step with reality. WNX is unicum.gg's continuously maintained take on the expected-value rating so the number you see reflects how tanks actually perform today.",
      "For most players WNX and WN8 land close together. They diverge most on recently rebalanced or newly added vehicles, where the older WN8 table has not caught up. If you want to compare against the wider community's historical numbers, switch the rating selector to WN8.",
      "WNX is the default metric on unicum.gg leaderboards and profiles. You can switch the displayed metric at any time from the rating selector in the navbar.",
    ],
    faq: [
      {
        question: "What is the difference between WNX and WN8?",
        answer:
          "Both are expected-value skill ratings built on the same idea. WNX is maintained on a fresher dataset so it tracks the current meta more closely, while WN8 reflects the widely-shared community baseline. They agree for most players and diverge mainly on recently changed vehicles.",
      },
      {
        question: "Why is WNX the default rating on unicum.gg?",
        answer:
          "Because it stays closest to the live game balance, WNX gives the most representative read on current skill. You can always switch to WN8 or WN7 from the rating selector.",
      },
      {
        question: "Do I need to log in for WNX to be calculated?",
        answer:
          "No. WNX is computed from public per-tank statistics returned by the Wargaming API, so it works for any account without a login.",
      },
    ],
    relatedSlugs: ["wn8", "wn7", "personal-rating"],
  },
  {
    slug: "wn7",
    shortName: "WN7",
    title: "WN7 rating",
    tagline: "The older efficiency rating that preceded WN8.",
    summary:
      "WN7 is the legacy World of Tanks efficiency rating that came before WN8. Learn what WN7 measures, why WN8 replaced it, and how to read it.",
    whatItMeasures:
      "WN7 estimates overall account efficiency from aggregate statistics: average damage, kills, spotting, defence, win rate and average tier. Unlike WN8 it is not based on per-tank expected values.",
    howItIsComputed:
      "WN7 is a closed-form formula over your account-wide averages plus your average tier, with a tier correction and a win-rate term. unicum.gg computes it from your aggregate statistics. Because it does not use per-tank expected values, it is cheaper to compute but less precise than WN8 or WNX.",
    body: [
      "WN7 was the dominant efficiency rating before WN8 arrived. Its weakness is that it leans on average tier and raw averages, which can be gamed: seal-clubbing in low tiers or padding a single strong tank can inflate it in ways WN8's per-tank model resists.",
      "It is kept on unicum.gg mainly for continuity and comparison. If you have an old WN7 number in mind, you can switch the rating selector to WN7 to see it, but WN8 or WNX give a more honest read on skill.",
      "WN7 uses the same orange to green to cyan to purple colour scale as the other ratings on the site.",
    ],
    faq: [
      {
        question: "Is WN7 still used?",
        answer:
          "Rarely. WN8 replaced WN7 as the community standard because it resists padding and seal-clubbing far better. WN7 is kept on unicum.gg for continuity and comparison.",
      },
      {
        question: "Why is my WN7 higher than my WN8?",
        answer:
          "WN7 rewards average tier and raw averages, so high-tier or single-tank-focused accounts can score higher on WN7 than on the per-tank WN8 model. That gap is exactly why WN8 was introduced.",
      },
    ],
    relatedSlugs: ["wn8", "wnx", "personal-rating"],
  },
  {
    slug: "personal-rating",
    shortName: "Personal Rating",
    title: "Personal Rating",
    tagline: "Wargaming's official in-game rating, returned by the API.",
    summary:
      "Personal Rating is Wargaming's official World of Tanks rating shown in game. Learn what it measures, why it differs from WN8 and WNX, and how to read it.",
    whatItMeasures:
      "Personal Rating is Wargaming's own composite score, shown in the in-game profile and returned by the public API as global_rating. It blends many account factors including battles played, wins, damage and survival.",
    howItIsComputed:
      "Wargaming computes Personal Rating with a proprietary formula and exposes the result directly through the API, so unicum.gg displays the official value rather than recomputing it. Because the formula rewards activity and accumulated results, Personal Rating climbs with volume as well as skill.",
    body: [
      "Personal Rating answers a different question from WN8 and WNX. Where the WN-family ratings try to isolate per-battle skill, Personal Rating is closer to an all-time account score: a veteran with hundreds of thousands of battles can hold a very high Personal Rating even with modest per-battle output, simply because the metric accumulates.",
      "This makes Personal Rating a poor tool for comparing skill between players of different activity levels, but a fine way to gauge overall account investment. For a skill comparison, use WN8 or WNX instead.",
      "Because it is an official Wargaming value, Personal Rating is consistent across every stats site that reads the API, since they all show the same number.",
    ],
    faq: [
      {
        question: "What is the difference between Personal Rating and WN8?",
        answer:
          "Personal Rating is Wargaming's official accumulating account score and rewards volume. WN8 is a community skill rating that isolates per-battle contribution. A high Personal Rating does not necessarily mean a high WN8.",
      },
      {
        question: "Where does Personal Rating come from?",
        answer:
          "It is computed by Wargaming and returned by the public API as global_rating. unicum.gg shows the official value directly.",
      },
    ],
    relatedSlugs: ["wn8", "wnx", "wn7"],
  },
];

export function getGlossaryMetric(slug: string): GlossaryMetric | undefined {
  return GLOSSARY_METRICS.find((m) => m.slug === slug);
}

export function glossaryMetricSlugs(): string[] {
  return GLOSSARY_METRICS.map((m) => m.slug);
}
