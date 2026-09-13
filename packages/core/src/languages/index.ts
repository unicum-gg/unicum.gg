import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  inferPlayerLanguages,
  LanguageSource,
  languagesToCountryCodes,
  playerClanHistoryByRegion,
  playerRatingsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  deserializeClanHistory,
  type SerializedClanHistory,
} from "../players/clan-history";

/**
 * What one id resolved to: the language codes, the flag each is drawn with, and
 * why we believe it.
 *
 * `countries` is aligned index for index with `languages` and holds a null
 * where we ship no flag, so the two can always be paired. It is served rather
 * than left to the caller because the mapping is a decision, not a derivation
 * (`en` is `GB-UKM` on EU and `US` elsewhere, `mo` is kept apart from `ro`),
 * and a client that re-derived it would need a release of its own every time
 * one of those moved.
 */
export type ResolvedLanguages = {
  languages: string[];
  countries: (string | null)[];
  source: LanguageSource;
};

export type LanguageResolution = {
  players: Record<number, ResolvedLanguages>;
  clans: Record<number, ResolvedLanguages>;
};

/**
 * How many ids one call resolves per kind.
 *
 * The driving caller is a Stronghold roster (a detachment list of ~20 clans, a
 * skirmish room of 15 players plus volunteers), so this is well clear of any
 * real roster and only bounds a hand-made request. Each kind is one indexed
 * read, so the ceiling is about keeping a single call's shape predictable
 * rather than about cost.
 */
export const MAX_IDS_PER_KIND = 100;

/**
 * Every language we hold for a set of account ids and clan ids, in one pass.
 *
 * The point is the batch: a roster row carries `dbID` and `clanDBID` and
 * nothing else, and resolving each one on its own costs a call per entity, the
 * clan half of which ships a whole clan document (ratings, name history,
 * emblem, tournament counts) for an array of two-letter codes.
 *
 * An id we hold no language for is ABSENT from the result rather than present
 * and empty. That is only honest because the caller cannot be over the cap
 * without being told (the endpoint refuses instead of truncating), so every id
 * that went in was really looked at and absence means "we have nothing",
 * never "we stopped early".
 *
 * Reads local tables only, never Wargaming: the clans and the rated players in
 * parallel, plus one more read for the accounts the rated table did not hold.
 */
export async function resolveLanguages(
  region: Region,
  ids: { players: number[]; clans: number[] },
): Promise<LanguageResolution> {
  const [players, clans] = await Promise.all([
    resolvePlayerLanguages(region, ids.players),
    resolveClanLanguages(region, ids.clans),
  ]);
  return { players, clans };
}

/** Declared by the clan owner, which is the whole answer for a clan: it is the
 * field WG serves and we store verbatim. */
async function resolveClanLanguages(
  region: Region,
  clanIds: number[],
): Promise<Record<number, ResolvedLanguages>> {
  if (clanIds.length === 0) return {};
  const clans = clansByRegion[region];
  const rows = await db
    .select({ id: clans.id, languages: clans.languages })
    .from(clans)
    .where(inArray(clans.id, clanIds));

  const out: Record<number, ResolvedLanguages> = {};
  for (const row of rows) {
    const entry = toResolved(row.languages, region, LanguageSource.Declared);
    if (entry) out[Number(row.id)] = entry;
  }
  return out;
}

/**
 * Three chained sources, because neither of the first two covers a real roster
 * on its own, and because the answer has to be the one the site already gives.
 *
 * `player_ratings` holds the inference precomputed hourly, but only for the top
 * pool (10,000 battles and a place in a metric's top ten thousand), so most
 * accounts in a random skirmish room are not in it. Their answer is the SAME
 * inference run on the spot over their stored clan history, through the very
 * function the player page renders from, not the current clan's declared set:
 * that set is a snapshot with no duration weighting, and an "international"
 * clan declaring en/ru/uk would hand back three languages where the player page
 * shows the one they actually speak. Two answers for one account, from one
 * site, is the thing worth spending a second read to avoid.
 *
 * The current clan is the last resort, for an account we hold no history for at
 * all, and `source` says so: `clan` is a declared set attributed to a player,
 * which is weaker than either inference above it.
 *
 * A soft-deleted account answers nothing. WG returns null for an account it has
 * purged under GDPR or restricted, and while the row survives here (so the
 * snapshot cron can retry it in 30 days), the clan it last belonged to is not
 * something to publish about a person who has been removed.
 */
async function resolvePlayerLanguages(
  region: Region,
  accountIds: number[],
): Promise<Record<number, ResolvedLanguages>> {
  if (accountIds.length === 0) return {};
  const players = playersByRegion[region];
  const ratings = playerRatingsByRegion[region];
  const rated = await db
    .select({ accountId: ratings.accountId, languages: ratings.languages })
    .from(ratings)
    .innerJoin(players, eq(players.accountId, ratings.accountId))
    .where(
      and(
        inArray(ratings.accountId, accountIds),
        isNull(players.softDeletedAt),
      ),
    );

  const out: Record<number, ResolvedLanguages> = {};
  for (const row of rated) {
    const entry = toResolved(row.languages, region, LanguageSource.Inferred);
    if (entry) out[Number(row.accountId)] = entry;
  }

  const unrated = accountIds.filter((id) => out[id] === undefined);
  if (unrated.length === 0) return out;

  // One read for both remaining sources: the history the inference runs on and
  // the current clan that answers when there is none. Splitting them would cost
  // a second round trip to learn nothing the first could not carry.
  const history = playerClanHistoryByRegion[region];
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      accountId: players.accountId,
      history: history.data,
      clanLanguages: clans.languages,
    })
    .from(players)
    .leftJoin(history, eq(history.accountId, players.accountId))
    .leftJoin(clans, eq(clans.id, players.clanId))
    .where(
      and(inArray(players.accountId, unrated), isNull(players.softDeletedAt)),
    );

  const nowMs = Date.now();
  for (const row of rows) {
    const inferred = row.history
      ? inferPlayerLanguages(
          deserializeClanHistory(row.history as SerializedClanHistory),
          nowMs,
        )
      : [];
    const entry =
      toResolved(inferred, region, LanguageSource.Inferred) ??
      toResolved(row.clanLanguages, region, LanguageSource.Clan);
    if (entry) out[Number(row.accountId)] = entry;
  }
  return out;
}

/** An empty declared set is a clan that never filled the field in, which is the
 * same answer as having no row at all, so it drops out here rather than
 * reaching the caller as an entry saying nothing. */
function toResolved(
  languages: string[] | null,
  region: Region,
  source: LanguageSource,
): ResolvedLanguages | null {
  if (!languages || languages.length === 0) return null;
  return {
    languages,
    countries: languagesToCountryCodes(languages, region),
    source,
  };
}
