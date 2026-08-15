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
  /** The current year's name, e.g. "Dragon" (from "YEAR OF THE DRAGON"). */
  yearName: string | null;
  /** The current year's seasons, in release order (the last is the current one:
   * the client localizes each season as it goes live). */
  seasons: Comp7Season[];
}

/**
 * Onslaught (Competitive 7) taxonomy from the wot-src mirror. The wgelen event
 * board only exposes the mode name ("Competitive 7") + a season's dates, never
 * the season codename ("Season of the Jade Dragon"); that lives in the client
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
    const po = await loadPo(
      BRANCH_BY_REGION[this.region],
      "comp7.comp7_ext",
      (url) => this.#text(url),
    );
    const yearRaw = po.get("rewardsScreen/description/year"); // "ONSLAUGHT. YEAR OF THE DRAGON"
    const yearName =
      yearRaw?.match(/YEAR OF THE\s+(.+?)\s*$/i)?.[1]?.trim() ?? null;

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
    return { yearName, seasons };
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
