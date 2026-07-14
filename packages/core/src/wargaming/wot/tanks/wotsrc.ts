import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type { WotSrcVehicle } from "@unicum.gg/wargaming";

export const fetchVehicleCatalog = (region: Region) =>
  wg.region(region).source.vehicles.catalog();
