// Writes the `game/` namespaces Wargaming publishes, from Wargaming, in every
// language it serves.
//
// These five files are not translated and not written by hand: a vehicle class,
// a nation, a crew role, a mastery badge and a clan rank already have a name in
// each of the twelve languages the game ships in, and it is the game's name. Asking a model
// to invent one, or keeping the English, is how a French player ends up reading
// a word their client never showed them.
//
// The other `game/` namespaces hold vocabulary the game has and the API does
// not expose (the mode names above all). Those go through the ordinary
// translator, with a prompt that asks for the game's own wording.
//
// Runs on `predev`/`prebuild`/`postinstall` like the other generators, and in
// the translations workflow before the model does its half. Needs
// WARGAMING_APPLICATION_ID_EU.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv-flow";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: webRoot });

// Precise subpaths, not the barrel: importing `@unicum.gg/shared` whole runs its
// env validation (the package declares `env.ts` as its one side effect), and a
// build script that only wants fourteen words has no business demanding every
// Wargaming application id be set.
import { CLAN_BOARD_LABEL } from "@unicum.gg/shared/clans/badges";
import { SHELL_LABEL } from "@unicum.gg/shared/wot/tank-spec-fields";
import { ACTIVITY_BUCKET_LABEL } from "@unicum.gg/shared/players/refresh-policy";
import {
  RATING_CONSENSUS_LABEL,
  RATING_HYPE_LABEL,
} from "@unicum.gg/shared/wot/tank-ratings";
import {
  TANK_RATING_AXIS_HINT,
  TANK_RATING_AXIS_LABEL,
  VOTER_BRACKET_LABEL,
} from "@unicum.gg/shared/db/schema/tank-ratings";
import { GLOSSARY_CATEGORY_LABEL } from "@unicum.gg/shared/glossary/category";
import { TOURNAMENT_STATUS_LABEL } from "@unicum.gg/shared/wot/tournaments";
import {
  STRONGHOLD_PERIOD_LABEL,
  STRONGHOLD_SORT_LABEL,
  STRONGHOLD_TIER_LABEL,
} from "@unicum.gg/shared/constants/stronghold";
import {
  VEHICLE_CLASS_LABEL,
  VEHICLE_ROLE_LABEL,
} from "@unicum.gg/shared/constants/tanks";
import {
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
} from "@unicum.gg/shared/db/schema/tank-videos";
import { MAP_CAMOUFLAGE_LABEL } from "@unicum.gg/shared/wot/maps/camouflage";
import { MAP_GAME_MODE_LABEL } from "@unicum.gg/shared/wot/maps/game-modes";
import {
  BATTLE_TYPE_LABEL,
  BattleType,
} from "@unicum.gg/shared/wot/maps/battle-types";
import { MAP_POI_LABEL } from "@unicum.gg/shared/wot/maps/points-of-interest";
import { ONSLAUGHT_TIER_LABEL } from "@unicum.gg/shared/wot/ratings";
import { SPAWN_DIRECTION_LABEL } from "@unicum.gg/shared/wot/tanks/videos";
import { TOURNAMENT_GAME_MODE_LABEL } from "@unicum.gg/shared/wot/tournaments";
import { PLAYER_MODE_LABEL } from "../src/components/players/detail/modes";
import { WARGAMING_LANGUAGE } from "../src/lib/game-vocabulary";
import { DEFAULT_LOCALE, type Locale } from "../src/lib/translations";

const localesRoot = join(webRoot, "src", "locales");
const APP_ID = process.env.WARGAMING_APPLICATION_ID_EU;
// The EU realm serves every language the API knows; the data is the game's, not
// the region's, so one realm is enough.
const HOST = "https://api.worldoftanks.eu";

type Json = Record<string, unknown>;

/**
 * `wot` for the game's own encyclopedia, `wgn` for what spans Wargaming's
 * games: clan ranks live on the network side, since a clan is a network object
 * rather than a World of Tanks one.
 */
async function wg(path: string, language: string, fields?: string, realm = "wot") {
  const url = new URL(`${HOST}/${realm}/${path}/`);
  url.searchParams.set("application_id", APP_ID as string);
  url.searchParams.set("language", language);
  if (fields) url.searchParams.set("fields", fields);
  const body = (await (await fetch(url)).json()) as {
    status: string;
    data?: Json;
    error?: { message: string };
  };
  if (body.status !== "ok" || !body.data) {
    throw new Error(`${path} (${language}): ${body.error?.message ?? "failed"}`);
  }
  return body.data;
}

/** The five namespaces, as they read in one language. */
async function vocabularyFor(language: string): Promise<Record<string, Json>> {
  const [info, achievements, clans] = await Promise.all([
    wg(
      "encyclopedia/info",
      language,
      "vehicle_types,vehicle_nations,vehicle_crew_roles",
    ),
    wg("encyclopedia/achievements", language, "options,name"),
    // Keyed by the same `role` we store on a membership, so a profile renders
    // the rank the player sees in their own client rather than the English
    // `role_i18n` that happened to be cached when the clan was last read.
    wg("clans/glossary", language, "clans_roles", "wgn"),
  ]);

  // The mastery badges are the four `options` of one achievement, weakest
  // first, which is the order the tables read them in.
  const mastery = achievements["markOfMastery"] as
    | { options?: { name_i18n: string }[] }
    | undefined;
  const [class3, class2, class1, ace] = (mastery?.options ?? []).map(
    (option) => option.name_i18n,
  );

  return {
    "game/vehicle-classes": info.vehicle_types as Json,
    "game/nations": info.vehicle_nations as Json,
    "game/crew-roles": info.vehicle_crew_roles as Json,
    "game/mastery": { class3, class2, class1, ace },
    "game/clan-roles": clans.clans_roles as Json,
  };
}

/**
 * OUR OWN label maps, as opposed to the game's.
 *
 * A rating verdict, a voter bracket, a glossary category and a refresh bucket
 * are the site's vocabulary, not Wargaming's, so they do not belong under
 * `game/` and must not be translated under a prompt that asks for the client's
 * wording. Derived from the same constants for the same reason: the constant
 * stays the one English source.
 */
function englishLabels(): Json {
  return {
    "activity-buckets": { ...ACTIVITY_BUCKET_LABEL },
    "rating-hype": { ...RATING_HYPE_LABEL },
    "rating-consensus": { ...RATING_CONSENSUS_LABEL },
    "rating-axes": { ...TANK_RATING_AXIS_LABEL },
    "rating-axis-hints": { ...TANK_RATING_AXIS_HINT },
    "voter-brackets": { ...VOTER_BRACKET_LABEL },
    "glossary-categories": { ...GLOSSARY_CATEGORY_LABEL },
  };
}

/**
 * The game's words that Wargaming's API does not publish, in English, read off
 * the constants the API and the Discord bot already answer with.
 *
 * Derived rather than retyped so the English side cannot drift: those constants
 * stay the one English source, and this is their translation input. One
 * namespace rather than fourteen so a locale costs one request rather than
 * fourteen for three keys each.
 */
function englishVocabulary(): Json {
  return {
    // The night version is Onslaught after dark, so its name is built from the
    // mode's own: a language that renames Onslaught renames this with it. See
    // `components/game-name`.
    "battle-types": {
      ...BATTLE_TYPE_LABEL,
      [BattleType.OnslaughtNight]: "{onslaught} Night",
    },
    "player-modes": { ...PLAYER_MODE_LABEL },
    "stronghold-tiers": { ...STRONGHOLD_TIER_LABEL },
    "stronghold-periods": { ...STRONGHOLD_PERIOD_LABEL },
    "stronghold-sorts": { ...STRONGHOLD_SORT_LABEL },
    "clan-boards": { ...CLAN_BOARD_LABEL },
    "map-modes": { ...MAP_GAME_MODE_LABEL },
    "map-camouflage": { ...MAP_CAMOUFLAGE_LABEL },
    "map-poi": { ...MAP_POI_LABEL },
    "tournament-modes": { ...TOURNAMENT_GAME_MODE_LABEL },
    "battle-formats": { ...BATTLE_FORMAT_LABEL },
    "battle-results": { ...BATTLE_RESULT_LABEL },
    "spawn-directions": { ...SPAWN_DIRECTION_LABEL },
    // Wargaming's own shell names and its own tournament statuses.
    shells: { ...SHELL_LABEL },
    "tournament-statuses": { ...TOURNAMENT_STATUS_LABEL },
    // The crest a player wears is the mode's name and the rank they reached,
    // and the order between them is the language's: "Offensive Légende" reads
    // wrong in French where "Légende Offensive" does. So it is a template rather
    // than a concatenation, like `{onslaught} Night` above.
    "onslaught-tiers": { ...ONSLAUGHT_TIER_LABEL, crest: "{mode} {tier}" },
    "vehicle-classes-short": { ...VEHICLE_CLASS_LABEL },
    "vehicle-roles": { ...VEHICLE_ROLE_LABEL },
    // The short forms a table column can carry. Wargaming's own full names for
    // the same four badges are in `game/mastery`, straight from its API
    // ("Mastery Badge: \"Class III\""), which is too long for a column head.
    "mastery-badges": {
      class3: "3rd Class",
      class2: "2nd Class",
      class1: "1st Class",
      ace: "Ace Tanker",
    },
    // The clan profile's three battle-mode tabs, which are the game's own.
    "clan-modes": {
      random: "Random Battles",
      stronghold: "Stronghold",
      skirmish: "Skirmish",
      "clan-wars": "Clan Wars",
    },
    // The game's name for a feature the site has a page about. Not a mode and
    // not a badge, so no constant elsewhere holds them.
    features: {
      stronghold: "Stronghold",
      skirmish: "Skirmish",
      "marks-of-excellence": "Marks of Excellence",
      "marks-of-mastery": "Marks of Mastery",
      "personal-rating": "Personal Rating",
      "world-of-tanks-rating": "World of Tanks Rating",
      "common-test": "Common Test",
      tournaments: "Tournaments",
    },
    // Wargaming's name for the gun marks, and for each count of them.
    marks: {
      name: "Marks of Excellence",
      1: "1 Mark",
      2: "2 Marks",
      3: "3 Marks",
    },
  };
}

function write(locale: Locale, namespace: string, value: Json): boolean {
  const path = join(localesRoot, locale, `${namespace}.json`);
  const next = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(path) && readFileSync(path, "utf-8") === next) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return true;
}

async function main(): Promise<void> {
  // The English half needs no network: it is the constants themselves.
  if (write(DEFAULT_LOCALE, "game/vocabulary", englishVocabulary())) {
    console.log(`[game-vocabulary] ${DEFAULT_LOCALE}/game/vocabulary`);
  }
  // Ours, beside the game's but not under `game/`: the translator's prompt for
  // that folder asks for the client's own wording, which is the right question
  // for a shell type and the wrong one for a glossary category.
  if (write(DEFAULT_LOCALE, "components/labels", englishLabels())) {
    console.log(`[game-vocabulary] ${DEFAULT_LOCALE}/components/labels`);
  }

  if (!APP_ID) {
    // Not fatal: the files are committed, so a checkout without credentials
    // builds against what Wargaming last said rather than against nothing.
    console.warn(
      "[game-vocabulary] WARGAMING_APPLICATION_ID_EU is not set, keeping the committed files",
    );
    return;
  }

  let written = 0;
  const entries = Object.entries(WARGAMING_LANGUAGE) as [Locale, string][];

  // One language at a time. Twelve languages is twenty-four requests, which the
  // WG API answers in a couple of seconds sequentially and refuses outright in
  // parallel (`REQUEST_LIMIT_EXCEEDED`): there is nothing to gain by racing a
  // rate limit for a file that changes on a game patch.
  for (const [locale, language] of entries) {
    let vocabulary;
    try {
      vocabulary = await vocabularyFor(language);
    } catch (error) {
      // One language failing must not drop the other eleven: the file it would
      // have written is already on disk from the last run.
      console.error(`[game-vocabulary] ${locale}:`, error);
      continue;
    }
    for (const [namespace, value] of Object.entries(vocabulary)) {
      if (write(locale, namespace, value)) {
        written++;
        console.log(`[game-vocabulary] ${locale}/${namespace}`);
      }
    }
  }

  // Every other locale is a language the game is not published in, so there is
  // no official wording to copy: they read English until the translator gives
  // them their own, which for these namespaces is the honest answer rather than
  // a second best.
  console.log(
    written
      ? `[game-vocabulary] wrote ${written} file(s) across ${entries.length} language(s), source ${DEFAULT_LOCALE}`
      : "[game-vocabulary] up to date",
  );
}

main().catch((error) => {
  console.error("[game-vocabulary] failed:", error);
  process.exit(1);
});
