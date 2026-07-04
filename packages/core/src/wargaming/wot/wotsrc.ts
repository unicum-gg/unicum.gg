import type { Region } from "@unicum.gg/wargaming/region";
import { wg } from "../client";

export type { WotSrcVehicle } from "@unicum.gg/wargaming/source/wot/vehicles";

export const fetchVehicleCatalog = (region: Region) =>
  wg.region(region).source.vehicles.catalog();
