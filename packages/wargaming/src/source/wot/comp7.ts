import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { loadPo } from "./localization";
import { BRANCH_BY_REGION, rawUrl, WOTSRC_CACHE_TTL_MS } from "./mirror";

// The ordinal-word vocabulary WG keys its comp7 seasons by, in release order.
// This is NOT maintainable data (the season names/count/dates are all derived
// below from the .po + DB): it is the fixed English key vocabulary WG uses in
// two places we don't control and can't derive an ordering for —
//   1. the localization keys: the display name "Season of the Jade Dragon"
//      exists only under `seasonName/third` (the numeric `yearlyStatistics/
//      seasonName/2` gives a different, unusable format "Season III. ...");
//   2. the rank-art folders on the assets mirror: `comp7/ranks/{first,second,
//      third}/...`, keyed by the same word, not a number.
// The .po decides how many seasons exist (we break at the first absent one), so
// only the ORDER of the words needs to be known here. `fourth`..`sixth` are a
// buffer over today's SEASONS_IN_YEAR=3; a new year reuses `first`/`second`/...
const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
] as const;

/** "PHOENIX" as the client's own archive would write it, "Phoenix". */
function titleCase(value: string | null): string | null {
  if (value == null) return null;
  return value.replace(
    /\S+/g,
    (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
  );
}

export interface Comp7Season {
  /** The ordinal word (`first`/`second`/`third`), matching the rank-art folder. */
  ordinal: string;
  /** Zero-based index within the year (0..2). */
  index: number;
  /** Full name, e.g. "Season of the Jade Dragon". */
  name: string;
  /** Short name, e.g. "Jade Dragon". */
  shortName: string;
}

export interface Comp7Taxonomy {
  /** The current year's name, e.g. "Phoenix" (from "YEAR OF THE PHOENIX"). */
  yearName: string | null;
  /**
   * The current year's number, the client's own `COMP7_MASKOT_ID`: "5" was the
   * Dragon year, "6" is the Phoenix year. It increments once per year, which
   * makes it the identity of a chapter, and the only thing here that says WHICH
   * year the season names below belong to.
   */
  yearId: string | null;
  /**
   * The current year's seasons, in release order.
   *
   * All three, from the year's first day: the client ships the whole year's
   * names at once rather than adding each as it goes live. So the live season is
   * NOT the last entry, and picking it needs a count of the seasons of this year
   * that have already been played (see the season resolution in core).
   */
  seasons: Comp7Season[];
}

/**
 * Onslaught (Competitive 7) taxonomy from the wot-src mirror. The event board
 * only exposes the mode name ("Competitive 7") + a season's dates, never the
 * season codename ("Season of the Jade Dragon"); that lives in the client
 * localization (`comp7.comp7_ext.po`): the current year's name + its season
 * names, keyed by ordinal in release order. Read once per region branch,
 * memoized by the shared `.po` loader.
 */
export class SourceComp7Resource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }

  async seasonTaxonomy(): Promise<Comp7Taxonomy> {
    const [po, yearId] = await Promise.all([
      loadPo(BRANCH_BY_REGION[this.region], "comp7.comp7_ext", (url) =>
        this.#text(url),
      ),
      this.yearId(),
    ]);
    // "ONSLAUGHT. YEAR OF THE PHOENIX". The heading is shouted, so the name is
    // title-cased back: it is read as a name ("Year of the Phoenix"), and it is
    // the same name `archiveYears()` returns once the year is over, where the
    // client writes it as "Phoenix". Normalising here is what lets the two
    // sources be compared at all.
    const yearRaw = po.get("rewardsScreen/description/year");
    const yearName = titleCase(
      yearRaw?.match(/YEAR OF THE\s+(.+?)\s*$/i)?.[1]?.trim() ?? null,
    );

    const seasons: Comp7Season[] = [];
    for (let i = 0; i < ORDINALS.length; i++) {
      const ordinal = ORDINALS[i];
      const name = po.get(`seasonName/${ordinal}`);
      if (!name) break; // contiguous ordinals: stop at the first absent season
      seasons.push({
        ordinal,
        index: i,
        name: name.trim(),
        shortName: po.get(`shortSeasonName/${ordinal}`)?.trim() ?? name.trim(),
      });
    }
    return { yearName, yearId, seasons };
  }

  /**
   * The current year's number, from the client's `COMP7_MASKOT_ID`. Null on a
   * fetch miss, which callers must treat as "unknown" rather than as a year:
   * stamping a season with the wrong chapter is not recoverable, since the
   * localization it would be re-derived from has moved on by then.
   */
  async yearId(): Promise<string | null> {
    const text = await this.#text(
      rawUrl(
        BRANCH_BY_REGION[this.region],
        "sources/res/comp7/scripts/common/comp7_common_const.py",
      ),
    ).catch(() => "");
    return /COMP7_MASKOT_ID\s*=\s*'([^']+)'/.exec(text)?.[1] ?? null;
  }

  /**
   * The finished (archived) year names, oldest first, e.g. `["Griffin",
   * "Pegasus", "Manticore"]`, from the client's `COMP7_ARCHIVE_NAMES` tuple.
   * These are whole past years the game keeps as aggregate archives (not broken
   * into seasons). Empty on a fetch miss.
   */
  async archiveYears(): Promise<string[]> {
    const text = await this.#text(
      rawUrl(
        BRANCH_BY_REGION[this.region],
        "sources/res/comp7/scripts/client/comp7/gui/Scaleform/daapi/view/lobby/profile/comp7_profile_helper.py",
      ),
    ).catch(() => "");
    const tuple = /COMP7_ARCHIVE_NAMES\s*=\s*\(([^)]*)\)/.exec(text)?.[1];
    if (!tuple) return [];
    return [...tuple.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
}
