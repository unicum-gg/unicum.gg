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
  const { data } = useSWR(
    region && nickname ? "support-tiers" : null,
    () => unicum.support.tiers(),
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
  const [nowMs] = useState(() => Date.now());
  const key = nickname?.toLowerCase();
  const entry = data?.supporters.find(
    (s) => s.region === region && s.nickname.toLowerCase() === key,
  );
  if (!entry) return { kind: CrestKind.Supporter, months: null };
  const months = supporterMonths(new Date(entry.since), nowMs);
  return { kind: SUPPORTER_TIER_CREST[supporterTier(months)], months };
}
