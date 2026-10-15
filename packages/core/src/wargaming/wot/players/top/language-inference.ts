import { sql, type SQL } from "drizzle-orm";
import { playerClanHistoryByRegion } from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";

// A language survives inference if it scores at least half the player's leader
// (matches `inferPlayerLanguages`).
const KEEP_RATIO = 0.5;

/**
 * The CTEs that infer each account's languages from its clan history, ending
 * in a `langs (account_id, languages)` relation, to splice into a `WITH`.
 *
 * Every stint (the current one runs to now) credits the clan's declared
 * languages with its duration, split evenly between them, and a language
 * survives if it scores at least half the account's leader. Shared by the
 * lifetime board (`recomputePlayerRatings`) and the recent ones
 * (`recomputePlayerPeriodRatings`) so a player cannot be French on one and
 * German on the other. `accounts` is a subquery yielding `account_id`, the
 * only accounts whose history is read.
 */
export function languageInferenceCtes(region: Region, accounts: SQL): SQL {
  const history = playerClanHistoryByRegion[region];
  return sql`
    histories AS (
      SELECT h.account_id, h.data
      FROM ${history} h
      WHERE h.account_id IN (${accounts})
    ),
    stints AS (
      SELECT h.account_id,
        h.data->'currentStint'->'clan'->'languages' AS langs,
        EXTRACT(EPOCH FROM
          NOW() - (h.data->'currentStint'->>'joinedAt')::timestamptz
        ) AS duration_s
      FROM histories h
      WHERE h.data->'currentStint' IS NOT NULL
      UNION ALL
      SELECT h.account_id,
        s->'clan'->'languages',
        EXTRACT(EPOCH FROM
          ((s->>'leftAt')::timestamptz - (s->>'joinedAt')::timestamptz)
        )
      FROM histories h, LATERAL jsonb_array_elements(h.data->'pastStints') s
      WHERE s->>'leftAt' IS NOT NULL
    ),
    expanded AS (
      SELECT account_id, lang,
        duration_s / NULLIF(jsonb_array_length(langs), 0) AS share
      FROM stints, LATERAL jsonb_array_elements_text(langs) lang
      WHERE jsonb_array_length(langs) > 0 AND duration_s > 0
    ),
    scores AS (
      SELECT account_id, lang, SUM(share) AS score
      FROM expanded GROUP BY account_id, lang
    ),
    ranked AS (
      SELECT account_id, lang, score,
        MAX(score) OVER (PARTITION BY account_id) AS max_score
      FROM scores
    ),
    survivors AS (
      SELECT account_id, lang
      FROM ranked
      WHERE score >= max_score * ${KEEP_RATIO}
    ),
    langs AS (
      SELECT account_id, array_agg(lang ORDER BY lang) AS languages
      FROM survivors
      GROUP BY account_id
    )`;
}
