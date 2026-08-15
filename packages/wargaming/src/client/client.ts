import { Region } from "../region";
import { Transport, type WargamingClientOptions } from "./transport";
import { AccountsResource } from "../api/wot/accounts";
import { AuthResource } from "../api/wot/auth";
import { EncyclopediaResource } from "../api/wot/encyclopedia";
import { TanksResource } from "../api/wot/tanks";
import { ApiClansResource } from "../api/wot/clans";
import { RatingsResource } from "../api/wot/ratings";
import { ClanRatingsResource } from "../api/wot/clan-ratings";
import { GlobalMapResource } from "../api/wot/global-map";
import { ServersResource } from "../api/wgn/servers";
import { ApiStrongholdResource } from "../api/wot/stronghold";
import { WgnClansResource } from "../api/wgn/clans";
import { PortalClansResource } from "../portal/wot/clans";
import { PortalProfileResource } from "../portal/wot/profile";
import { StrongholdResource } from "../stronghold/wot";
import { SourceVehiclesResource } from "../source/wot/vehicles";
import { SourceArenasResource } from "../source/wot/arenas";
import { SourceSpecsResource } from "../source/wot/specs";
import { SourceEquipmentResource } from "../source/wot/equipment";
import { SourceCrewResource } from "../source/wot/crew";
import { SourcePostProgressionResource } from "../source/wot/post-progression";
import { SourceSkillTreeResource } from "../source/wot/skill-tree";
import { SourceComp7Resource } from "../source/wot/comp7";

/** World of Tanks endpoints (`/wot/*`). */
class WotApiSurface {
  readonly accounts: AccountsResource;
  readonly auth: AuthResource;
  readonly encyclopedia: EncyclopediaResource;
  readonly tanks: TanksResource;
  readonly clans: ApiClansResource;
  readonly ratings: RatingsResource;
  readonly clanRatings: ClanRatingsResource;
  readonly globalMap: GlobalMapResource;
  readonly stronghold: ApiStrongholdResource;

  constructor(transport: Transport, region: Region) {
    this.accounts = new AccountsResource(transport, region);
    this.auth = new AuthResource(transport, region);
    this.encyclopedia = new EncyclopediaResource(transport, region);
    this.tanks = new TanksResource(transport, region);
    this.clans = new ApiClansResource(transport, region);
    this.ratings = new RatingsResource(transport, region);
    this.clanRatings = new ClanRatingsResource(transport, region);
    this.globalMap = new GlobalMapResource(transport, region);
    this.stronghold = new ApiStrongholdResource(transport, region);
  }
}

/** WGN cross-game endpoints (`/wgn/*`). */
class WgnApiSurface {
  readonly servers: ServersResource;
  readonly clans: WgnClansResource;

  constructor(transport: Transport, region: Region) {
    this.servers = new ServersResource(transport, region);
    this.clans = new WgnClansResource(transport, region);
  }
}

/** The official WG API surface (`api.worldoftanks.*`, application_id). */
class ApiSurface {
  readonly wot: WotApiSurface;
  readonly wgn: WgnApiSurface;

  constructor(transport: Transport, region: Region) {
    this.wot = new WotApiSurface(transport, region);
    this.wgn = new WgnApiSurface(transport, region);
  }
}

/** The portal surface (clan portal on `<region>.wargaming.net`, plus the player
 * profile SPA on `worldoftanks.<tld>`). */
class PortalSurface {
  readonly clans: PortalClansResource;
  readonly profile: PortalProfileResource;

  constructor(transport: Transport, region: Region) {
    this.clans = new PortalClansResource(transport, region);
    this.profile = new PortalProfileResource(transport, region);
  }
}

/** Third-party game-data sources (e.g. the wot-src vehicle catalogue). */
class SourceSurface {
  readonly vehicles: SourceVehiclesResource;
  readonly arenas: SourceArenasResource;
  readonly specs: SourceSpecsResource;
  readonly equipment: SourceEquipmentResource;
  readonly crew: SourceCrewResource;
  readonly postProgression: SourcePostProgressionResource;
  readonly skillTree: SourceSkillTreeResource;
  readonly comp7: SourceComp7Resource;

  constructor(transport: Transport, region: Region) {
    this.vehicles = new SourceVehiclesResource(transport, region);
    this.arenas = new SourceArenasResource(transport, region);
    this.specs = new SourceSpecsResource(transport, region);
    this.equipment = new SourceEquipmentResource(transport, region);
    this.crew = new SourceCrewResource(transport, region);
    this.postProgression = new SourcePostProgressionResource(transport, region);
    this.skillTree = new SourceSkillTreeResource(transport, region);
    this.comp7 = new SourceComp7Resource(transport, region);
  }
}

/** Everything for a single region — `wg.eu`, `wg.na`, `wg.asia`. */
class RegionClient {
  readonly api: ApiSurface;
  readonly portal: PortalSurface;
  readonly stronghold: StrongholdResource;
  readonly source: SourceSurface;

  constructor(transport: Transport, region: Region) {
    this.api = new ApiSurface(transport, region);
    this.portal = new PortalSurface(transport, region);
    this.stronghold = new StrongholdResource(transport, region);
    this.source = new SourceSurface(transport, region);
  }
}

/**
 * A configured Wargaming client. Construct once with your credentials, then
 * navigate `wg.<region>.<surface>.<resource>.<method>()`, e.g.
 * `wg.eu.api.wot.accounts.info({ accountId })`.
 */
export class WargamingClient {
  readonly #transport: Transport;
  readonly #regions = new Map<Region, RegionClient>();

  constructor(options: WargamingClientOptions) {
    this.#transport = new Transport(options);
  }

  get eu(): RegionClient {
    return this.#region(Region.EU);
  }
  get na(): RegionClient {
    return this.#region(Region.NA);
  }
  get asia(): RegionClient {
    return this.#region(Region.ASIA);
  }

  region(region: Region): RegionClient {
    return this.#region(region);
  }

  /** Empty the response cache. */
  clearCache(): Promise<void> {
    return this.#transport.clearCache();
  }

  /** Inspect the response cache (entry count + keys). */
  cacheStats(): Promise<{ size: number; keys: string[] }> {
    return this.#transport.cacheStats();
  }

  #region(region: Region): RegionClient {
    let client = this.#regions.get(region);
    if (!client) {
      client = new RegionClient(this.#transport, region);
      this.#regions.set(region, client);
    }
    return client;
  }
}
