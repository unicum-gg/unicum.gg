import { XMLParser } from "fast-xml-parser";
import { isObject, num, numList, tokens, resolveModule, topModuleKey, type XmlNode } from "./xml";
import type { TankConfigs, WotSrcConfig, WotSrcSpec } from "./spec";
import { Region } from "../../../region";
import type { Transport } from "../../../client/transport";
import { RateLimit } from "../../../client/rate-limiter";
import { fetchNations } from "../nations";
import {
  branchFor,
  fetchBranchVersion,
  computeTankId,
  rawUrl,
  VEHICLE_TYPES,
  WOTSRC_CACHE_TTL_MS,
  WotSrcBranch,
} from "../mirror";
import { derive, deriveConfigs } from "./derive";
import {
  calibratedShells,
  switchesShells,
  type CalibratedShell,
} from "./calibration";
import { mechanicOf } from "./mechanic";
import { getShellKinds } from "./shell-kinds";
import { resolveRef } from "../localization";
export * from "./spec";

export * from "./calibration";
export * from "./mechanic";

export * from "./xml";


/** What a vehicle's own files say about whether it can be dressed. */
export type WotSrcCustomization = {
  /** The tags its nation's index files it under, verbatim and in order. */
  tags: string[];
  /**
   * The vehicle's `customDefaultCamouflage`: it ships wearing a livery of its
   * own, drawn into its textures rather than chosen by the player.
   */
  customDefaultCamouflage: boolean;
};

/**
 * Vehicle specs from the IzeBerg/wot-src client-scripts mirror. Loops all
 * nations with the shared component files fetched once per nation, and derives
 * the stock top-configuration stat block for every combat vehicle.
 */
export class SourceSpecsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** The client build a mirror branch was extracted from, e.g. `2.4.0.5415`. */
  branchVersion(branch: WotSrcBranch): Promise<string | null> {
    return fetchBranchVersion(branch, (url) => this.#text(url));
  }

  async catalog(branchOverride?: WotSrcBranch): Promise<WotSrcSpec[]> {
    const branch = branchFor(this.region, branchOverride);
    const nations = await fetchNations(this.t, branch);
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const results = await Promise.all(
      nations.map((nation, idx) =>
        this.#nation(branch, nation, idx, parser).catch((err) => {
          console.error(`[wotsrc-specs-${this.region}] ${nation} failed:`, err);
          return [] as WotSrcSpec[];
        }),
      ),
    );
    return results.flat();
  }

  async #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }

  #root(parser: XMLParser, xml: string): XmlNode {
    const doc = parser.parse(xml) as XmlNode;
    const key = Object.keys(doc).find((k) => k !== "?xml");
    const root = key ? doc[key] : undefined;
    return isObject(root) ? root : {};
  }

  /** The `<shared>` block of a component file, keyed by module name. */
  #shared(root: XmlNode): XmlNode {
    return isObject(root.shared) ? root.shared : {};
  }

  async #nation(
    branch: WotSrcBranch,
    nation: string,
    nationIdx: number,
    parser: XMLParser,
  ): Promise<WotSrcSpec[]> {
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const comp = (c: string) => this.#text(rawUrl(branch, `${base}/components/${c}.xml`));
    const [listXml, gunsXml, shellsXml, turretsXml, enginesXml, chassisXml, radiosXml, fuelXml] =
      await Promise.all([
        this.#text(rawUrl(branch, `${base}/list.xml`)),
        comp("guns"),
        comp("shells"),
        comp("turrets"),
        comp("engines"),
        comp("chassis"),
        comp("radios"),
        comp("fuelTanks"),
      ]);

    const list = this.#root(parser, listXml);
    const guns = this.#shared(this.#root(parser, gunsXml));
    // shells.xml lists shell defs directly under root (no <shared> wrapper).
    const shells = this.#root(parser, shellsXml);
    const turrets = this.#shared(this.#root(parser, turretsXml));
    const engines = this.#shared(this.#root(parser, enginesXml));
    const chassis = this.#shared(this.#root(parser, chassisXml));
    const radios = this.#shared(this.#root(parser, radiosXml));
    const fuelTanks = this.#shared(this.#root(parser, fuelXml));

    const shared = { guns, shells, turrets, engines, chassis, radios, fuelTanks };

    const out: WotSrcSpec[] = [];
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      const localId = Number.parseInt(String(entry.id ?? "").trim(), 10);
      if (!Number.isFinite(localId)) continue;
      const type = this.#extractType(entry.tags);
      if (!type) continue;
      try {
        const vehXml = await this.#text(rawUrl(branch, `${base}/${tag}.xml`));
        const root = this.#root(parser, vehXml);
        const spec = derive(
          computeTankId(nationIdx, localId),
          tag,
          root,
          shared,
          entry,
        );
        out.push(spec);
      } catch (err) {
        console.error(`[wotsrc-specs-${this.region}] ${nation}/${tag} failed:`, err);
      }
    }
    return out;
  }

  #extractType(tags: unknown): string | null {
    if (typeof tags !== "string") return null;
    for (const t of tags.split(/\s+/)) if (VEHICLE_TYPES.has(t)) return t;
    return null;
  }

  async configs(
    tankId: number,
    branchOverride?: WotSrcBranch,
  ): Promise<TankConfigs | null> {
    const branch = branchFor(this.region, branchOverride);
    const nations = await fetchNations(this.t, branch);
    const nationIdx = (tankId >> 4) & 0xf;
    const localId = tankId >> 8;
    const nation = nations[nationIdx];
    if (!nation) return null;

    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const comp = (c: string) => this.#text(rawUrl(branch, `${base}/components/${c}.xml`));
    const [listXml, gunsXml, shellsXml, turretsXml, enginesXml, chassisXml, radiosXml, fuelXml] =
      await Promise.all([
        this.#text(rawUrl(branch, `${base}/list.xml`)),
        comp("guns"),
        comp("shells"),
        comp("turrets"),
        comp("engines"),
        comp("chassis"),
        comp("radios"),
        comp("fuelTanks"),
      ]);

    const list = this.#root(parser, listXml);
    const shared = {
      guns: this.#shared(this.#root(parser, gunsXml)),
      shells: this.#root(parser, shellsXml),
      turrets: this.#shared(this.#root(parser, turretsXml)),
      engines: this.#shared(this.#root(parser, enginesXml)),
      chassis: this.#shared(this.#root(parser, chassisXml)),
      radios: this.#shared(this.#root(parser, radiosXml)),
      fuelTanks: this.#shared(this.#root(parser, fuelXml)),
    };

    let match: { tag: string; entry: XmlNode } | null = null;
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      if (Number.parseInt(String(entry.id ?? "").trim(), 10) === localId) {
        match = { tag, entry };
        break;
      }
    }
    if (!match) return null;

    const vehXml = await this.#text(rawUrl(branch, `${base}/${match.tag}.xml`));
    const root = this.#root(parser, vehXml);
    const configs = deriveConfigs(tankId, match.tag, root, shared, match.entry);
    // **What its shells become once the gun opens its extra chambers.**
    //
    // The deployed definition is fetched only where a gun declares the
    // mechanic, which is a handful of vehicles: most of them have one of these
    // files and almost none restates a shell in it, so asking every time would
    // be a second request per tank for nothing.
    //
    // A vehicle that declares it and has no such file is not an error worth
    // failing a whole spec over: it reads as a gun that calibrates nothing.
    // Which of the seven mechanics its second state is, read from the tags the
    // nation list carries and the blocks its own components declare.
    const mechanic = mechanicOf(
      root,
      tokens(isObject(match.entry) ? match.entry.tags : null),
    );
    for (const c of configs) c.spec.mechanic = mechanic;
    let calibrated = new Map<string, CalibratedShell>();
    if (switchesShells(root)) {
      try {
        const deployed = await this.#text(
          rawUrl(branch, `${base}/${match.tag}_siege_mode.xml`),
        );
        calibrated = calibratedShells(this.#root(parser, deployed));
      } catch {
        calibrated = new Map();
      }
    }
    // Label each shell from WoT's own localization (both memoized), not a
    // hand-kept map: the kind's short code + full name from `item_types.po`, and
    // the shell's specific name from its `userString` (in the nation `.po`),
    // composed with the gun caliber (`122 mm UOF-471`).
    const fetchText = (url: string) => this.#text(url);
    const kinds = await getShellKinds(branch, fetchText);
    for (const c of configs) {
      const caliber = c.spec.caliber;
      for (const st of c.spec.shellStats) {
        const k = kinds.get(st.type);
        st.shortName = k?.short ?? null;
        st.kindName = k?.name ?? null;
        const specific = st.userString
          ? await resolveRef(st.userString, branch, fetchText)
          : null;
        st.name = specific
          ? caliber != null
            ? `${caliber} mm ${specific}`
            : specific
          : null;
        // Matched on the shell's own element name, which is what its reference
        // ends with: `#germany_vehicles:_120_mm_Hartkern_…` is the same
        // `_120_mm_Hartkern_…` the deployed `<shots>` block keys on.
        const own = st.userString?.split(":").pop();
        const changes = own ? calibrated.get(own) : undefined;
        if (changes) st.calibrated = changes;
      }
    }
    return { tankId, tag: match.tag, configs };
  }

  /**
   * The vehicle's crew composition from its client XML `<crew>`, plus its nation
   * (for the portraits). One entry per physical crew member, each the roles it
   * fills: the element name is the primary role, and its text lists the extra
   * roles the same member covers (a Swedish TD's driver also gunning, encoded
   * `<driver>gunner</driver>`). Several members of one role (two loaders) parse
   * as an array under that element, so each becomes its own member. Null when
   * the tank resolves to no vehicle file, or the file carries no crew.
   */
  async crew(
    tankId: number,
    branchOverride?: WotSrcBranch,
  ): Promise<{ nation: string; members: string[][] } | null> {
    const found = await this.#vehicleFile(tankId, branchOverride);
    if (!found) return null;
    const crewNode = isObject(found.root.crew) ? found.root.crew : null;
    if (!crewNode) return null;

    const members: string[][] = [];
    for (const [role, value] of Object.entries(crewNode)) {
      // Same-role members (two loaders) parse as an array; a single one is the
      // bare value. Self-closing (`<commander/>`) carries no text, so no extra
      // role; text (`gunner`) names the further roles that member also fills.
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        const extra =
          typeof item === "string" ? item.split(/\s+/).filter(Boolean) : [];
        members.push([role, ...extra]);
      }
    }
    return members.length > 0 ? { nation: found.nation, members } : null;
  }

  /**
   * What the client's own files say about dressing this vehicle: the tags its
   * nation files it under, and whether it left the factory already painted.
   *
   * Both are reported verbatim rather than decided here, since a filter's worth
   * of meaning hangs off them and none of it is Wargaming's: `lockOutfit` turns
   * the garage's customization entry off, `customDefaultCamouflage` puts a
   * camouflage of the client's own over the whole hull, and what a site does
   * about either is the site's opinion.
   *
   * Null where the vehicle resolves to no file, the same answer `crew` gives.
   */
  async customization(
    tankId: number,
    branchOverride?: WotSrcBranch,
  ): Promise<WotSrcCustomization | null> {
    const found = await this.#vehicleFile(tankId, branchOverride);
    if (!found) return null;
    return {
      tags: tokens(found.entry.tags),
      // Written as the text `true` in the handful of files that carry it, and
      // absent everywhere else, so it is read as a word rather than coerced: the
      // parser is set to leave values as strings, where every non-empty one is
      // truthy.
      customDefaultCamouflage:
        String(found.root.customDefaultCamouflage ?? "")
          .trim()
          .toLowerCase() === "true",
    };
  }

  /**
   * One vehicle's own definition, with its nation index entry beside it.
   *
   * Three things the client keeps apart have to be put back together before any
   * fact about a vehicle can be read: which nation files it (from the id), what
   * that nation calls it (from the nation's index), and what it declares (its
   * own file). Null where any of them is missing, which is an answer rather
   * than a failure: an id the lists no longer carry is a vehicle the game has
   * retired.
   */
  async #vehicleFile(
    tankId: number,
    branchOverride?: WotSrcBranch,
  ): Promise<{
    nation: string;
    tag: string;
    entry: XmlNode;
    root: XmlNode;
  } | null> {
    const branch = branchFor(this.region, branchOverride);
    const nations = await fetchNations(this.t, branch);
    const nationIdx = (tankId >> 4) & 0xf;
    const localId = tankId >> 8;
    const nation = nations[nationIdx];
    if (!nation) return null;

    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const list = this.#root(
      parser,
      await this.#text(rawUrl(branch, `${base}/list.xml`)),
    );
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      if (Number.parseInt(String(entry.id ?? "").trim(), 10) !== localId)
        continue;
      const root = this.#root(
        parser,
        await this.#text(rawUrl(branch, `${base}/${tag}.xml`)),
      );
      return { nation, tag, entry, root };
    }
    return null;
  }
}
