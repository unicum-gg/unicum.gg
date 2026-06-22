import type { ComponentType } from "react";
import { env } from "env";
import type { AdFormat } from "./ad-config";
import { AdSenseSlot } from "./networks/adsense-slot";

/**
 * Ad networks on the roadmap. Per the CMO revenue model (UNI-47) the network is the
 * dominant revenue lever (gaming-vertical Ezoic/Playwire deliver 3-5x raw AdSense RPM),
 * not the placement geometry. Sequenced: AdSense now (fallback), Ezoic at low volume,
 * Playwire/Snigel at 50k+ sessions.
 */
export enum AdNetwork {
  AdSense = "adsense",
  Ezoic = "ezoic",
  Playwire = "playwire",
}

/**
 * The active network, injected via env (defaults to AdSense, the only one wired today).
 * Because the unit markup + activation live behind a per-network adapter, moving
 * AdSense -> Ezoic -> Playwire is adding an adapter and flipping this flag, never a
 * rewrite of AdSlot. This is the network-agnostic requirement from UNI-47.
 */
export function activeAdNetwork(): AdNetwork {
  return (env.NEXT_PUBLIC_AD_NETWORK as AdNetwork | undefined) ?? AdNetwork.AdSense;
}

/**
 * Props every network adapter receives from AdSlot. AdSlot owns everything
 * network-agnostic (reserved space / CLS, lazy-load, consent + flag gating, density,
 * the label); the adapter owns only its unit markup and activation lifecycle.
 */
export interface AdNetworkSlotProps {
  slot: string;
  format: AdFormat;
  layoutKey?: string;
  responsive: boolean;
}

/**
 * Per-network adapter registry. Only AdSense is implemented today; Ezoic/Playwire slot
 * in here when their roadmap step lands (UNI-46 / CMO), with no change to AdSlot. A
 * missing adapter for the active network makes AdSlot render nothing (fails safe).
 */
export const AD_NETWORK_SLOTS: Partial<
  Record<AdNetwork, ComponentType<AdNetworkSlotProps>>
> = {
  [AdNetwork.AdSense]: AdSenseSlot,
};
