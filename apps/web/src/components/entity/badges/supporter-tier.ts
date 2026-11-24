import { useState } from "react";
import useSWR from "swr";
import {
  SupporterTier,
  supporterMonths,
  supporterTier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { CrestKind } from "@/components/entity/badges/crest";
import { unicum } from "@/services/sdk";

/**
 * One public supporter's row of `/support/tiers`, matched on region and
 * nickname, or undefined (not a public supporter, or not arrived yet). Every
 * reader shares one SWR entry, so the crests and the styled nicknames of a
 * whole board cost one request for the visit. Nothing is asked for while
 * `nickname` is undefined, which is how a caller says "not a supporter".
 */
export function useSupporterEntry(
  region: Region | undefined,
  nickname: string | undefined,
) {
  const { data } = useSWR(
    region && nickname ? "support-tiers" : null,
    () => unicum.support.tiers(),
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
  const key = nickname?.toLowerCase();
  return data?.supporters.find(
    (s) => s.region === region && s.nickname.toLowerCase() === key,
  );
}

/** The crest each tier is drawn as. */
export const SUPPORTER_TIER_CREST: Record<SupporterTier, CrestKind> = {
  [SupporterTier.Base]: CrestKind.Supporter,
  [SupporterTier.Bronze]: CrestKind.SupporterBronze,
  [SupporterTier.Silver]: CrestKind.SupporterSilver,
  [SupporterTier.Gold]: CrestKind.SupporterGold,
};

/**
 * How long a public supporter has held their pledge, and the crest that earns.
 *
 * Every crest on a page reads the same SWR entry, so a leaderboard of fifty
 * rows costs one request for the whole site visit, and the payloads carrying
 * `isSupporter` never had to learn about seniority. Until it arrives, and for a
 * supporter it does not list (anonymous, or matched on a name that has since
 * changed), the crest is the plain supporter one with no month count: exactly
 * what it was before tiers existed.
 */
export function useSupporterTier(
  region: Region | undefined,
  nickname: string | undefined,
): { kind: CrestKind; months: number | null } {
  const entry = useSupporterEntry(region, nickname);
  const [nowMs] = useState(() => Date.now());
  if (!entry) return { kind: CrestKind.Supporter, months: null };
  const months = supporterMonths(new Date(entry.since), nowMs);
  return { kind: SUPPORTER_TIER_CREST[supporterTier(months)], months };
}
