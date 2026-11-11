import { iconUrl } from "./assets";

/**
 * What a place on a Maneuvers board is worth, by the event's published
 * regulations (the clan guide's "Maneuvers" page, as of the autumn 2026
 * edition).
 *
 * The source publishes two of these figures per edition, the share of the
 * personal board that earns bonds and the share of the clan board whose
 * members get a multiplier above one, so those are read off the edition when
 * it carries them. Everything else (the bond tiers, the multipliers, the
 * badges and medals) is only in the regulations and is written here.
 *
 * Two things cannot be known from the boards and are said rather than guessed:
 * the regulations never define the base a percentage is taken over (we use the
 * ranked field at the last capture), and every badge and medal also asks for a
 * number of battles played FOR the clan, which the source does not publish. So
 * a badge here is "in position for", never "earned".
 */

/** Bonds by share of the personal board, best first. The last tier ends where
 * the edition's `accountBondsPercent` says, 75% when it says nothing. */
export const MANEUVERS_BOND_TIERS: readonly (readonly [number, number])[] = [
  [0.1, 750],
  [0.2, 700],
  [0.3, 600],
  [0.4, 500],
  [0.5, 400],
  [0.75, 250],
];

/** Bond multiplier by share of the clan board, best first. Past the edition's
 * `clanBondsPercent` (50% when it says nothing) every clan is at one. */
export const MANEUVERS_CLAN_MULTIPLIERS: readonly (readonly [number, number])[] = [
  [0.1, 4],
  [0.2, 3.5],
  [0.3, 3],
  [0.4, 2.5],
  [0.5, 2],
];

export const DEFAULT_ACCOUNT_BONDS_PERCENT = 75;
export const DEFAULT_CLAN_BONDS_PERCENT = 50;

/** Battles for the clan a badge or medal asks for, which the boards cannot see. */
export const MANEUVERS_CLAN_BATTLES = 5;
/** The Legend badge's share of event battles played for the top clan. */
export const MANEUVERS_LEGEND_BATTLE_SHARE = 0.5;

export enum ManeuversMedal {
  Winner = "winner",
  Top2 = "top-2",
  Top3 = "top-3",
  Top10 = "top-10",
  Top100 = "top-100",
}

/** The share of the field a badge's clan (and, for Legend, player) must sit in. */
export const MANEUVERS_LEGEND_SHARE = 0.01;
export const MANEUVERS_HERO_SHARE = 0.1;

/** Whether `place` sits in the top `share` of a field of `ranked`. At least
 * the first place always does, so a tiny field still has a top 1%. */
export function inTopShare(place: number, ranked: number, share: number): boolean {
  if (ranked <= 0 || place <= 0) return false;
  return place <= Math.max(1, Math.ceil(share * ranked));
}

/** The last place inside the top `share` of a field of `ranked`. */
export function topShareLastPlace(ranked: number, share: number): number {
  return ranked <= 0 ? 0 : Math.max(1, Math.ceil(share * ranked));
}

export type ManeuversBondTier = {
  /** Share of the board the tier reaches down to. */
  share: number;
  bonds: number;
  /** Places it covers on the board as it stands. */
  fromPlace: number;
  toPlace: number;
};

/** The bond tiers as places on today's board, best first. */
export function maneuversBondTiers(
  ranked: number,
  accountBondsPercent: number | null,
): ManeuversBondTier[] {
  const ceiling = (accountBondsPercent ?? DEFAULT_ACCOUNT_BONDS_PERCENT) / 100;
  const tiers: ManeuversBondTier[] = [];
  let from = 1;
  // A tier reaching past the edition's own ceiling is cut at it, and none
  // starts beyond it.
  for (const [tierShare, bonds] of MANEUVERS_BOND_TIERS) {
    const share = Math.min(tierShare, ceiling);
    const to = topShareLastPlace(ranked, share);
    if (to >= from) tiers.push({ share, bonds, fromPlace: from, toPlace: to });
    from = Math.max(from, to + 1);
    if (tierShare >= ceiling) break;
  }
  return tiers;
}

export type ManeuversMultiplierTier = {
  share: number;
  multiplier: number;
  fromPlace: number;
  toPlace: number;
};

/** The clan multipliers as places on today's clan board, best first, ending
 * with the clans at one. */
export function maneuversMultiplierTiers(
  clansRanked: number,
  clanBondsPercent: number | null,
): ManeuversMultiplierTier[] {
  const ceiling = (clanBondsPercent ?? DEFAULT_CLAN_BONDS_PERCENT) / 100;
  const tiers: ManeuversMultiplierTier[] = [];
  let from = 1;
  for (const [tierShare, multiplier] of MANEUVERS_CLAN_MULTIPLIERS) {
    const share = Math.min(tierShare, ceiling);
    const to = topShareLastPlace(clansRanked, share);
    if (to >= from) tiers.push({ share, multiplier, fromPlace: from, toPlace: to });
    from = Math.max(from, to + 1);
    if (tierShare >= ceiling) break;
  }
  if (clansRanked >= from) {
    tiers.push({ share: 1, multiplier: 1, fromPlace: from, toPlace: clansRanked });
  }
  return tiers;
}

/** The bonds a personal place earns before the clan multiplier, 0 past the
 * last tier. */
export function maneuversBonds(
  place: number,
  ranked: number,
  accountBondsPercent: number | null,
): number {
  return (
    maneuversBondTiers(ranked, accountBondsPercent).find(
      (t) => place >= t.fromPlace && place <= t.toPlace,
    )?.bonds ?? 0
  );
}

/** The multiplier a clan place gives its members' bonds, 1 when unranked. */
export function maneuversMultiplier(
  clanPlace: number | null,
  clansRanked: number,
  clanBondsPercent: number | null,
): number {
  if (clanPlace == null) return 1;
  return (
    maneuversMultiplierTiers(clansRanked, clanBondsPercent).find(
      (t) => clanPlace >= t.fromPlace && clanPlace <= t.toPlace,
    )?.multiplier ?? 1
  );
}

/** The medal a clan place carries to its members, null below the top 100. */
export function maneuversMedal(clanPlace: number | null): ManeuversMedal | null {
  if (clanPlace == null) return null;
  if (clanPlace === 1) return ManeuversMedal.Winner;
  if (clanPlace === 2) return ManeuversMedal.Top2;
  if (clanPlace === 3) return ManeuversMedal.Top3;
  if (clanPlace <= 10) return ManeuversMedal.Top10;
  if (clanPlace <= 100) return ManeuversMedal.Top100;
  return null;
}

export type ManeuversPlayerRewards = {
  vehicle: boolean | null;
  bonds: number;
  multiplier: number;
  /** Bonds after the clan multiplier. */
  totalBonds: number;
  /** The next better bond tier and the place it starts at, null at the top or
   * when the board cannot say. */
  nextTier: { bonds: number; place: number } | null;
  /** In position for each badge, on the board's side of its conditions. */
  legend: boolean;
  hero: boolean;
  medal: ManeuversMedal | null;
};

/** Everything a player's place and their clan's place are worth today. */
export function maneuversPlayerRewards(input: {
  place: number;
  ranked: number;
  vehiclePositions: number | null;
  accountBondsPercent: number | null;
  clanPlace: number | null;
  clansRanked: number;
  clanBondsPercent: number | null;
}): ManeuversPlayerRewards {
  const tiers = maneuversBondTiers(input.ranked, input.accountBondsPercent);
  const current = tiers.findIndex(
    (t) => input.place >= t.fromPlace && input.place <= t.toPlace,
  );
  const bonds = current >= 0 ? tiers[current].bonds : 0;
  const better = current > 0 ? tiers[current - 1] : current < 0 ? tiers.at(-1) : undefined;
  const multiplier = maneuversMultiplier(
    input.clanPlace,
    input.clansRanked,
    input.clanBondsPercent,
  );
  const clanIn = (share: number) =>
    input.clanPlace != null && inTopShare(input.clanPlace, input.clansRanked, share);
  return {
    vehicle:
      input.vehiclePositions == null ? null : input.place <= input.vehiclePositions,
    bonds,
    multiplier,
    totalBonds: Math.round(bonds * multiplier),
    nextTier: better ? { bonds: better.bonds, place: better.toPlace } : null,
    legend:
      inTopShare(input.place, input.ranked, MANEUVERS_LEGEND_SHARE) &&
      clanIn(MANEUVERS_LEGEND_SHARE),
    hero: clanIn(MANEUVERS_HERO_SHARE),
    medal: maneuversMedal(input.clanPlace),
  };
}

export enum ManeuversBadge {
  /** Badge 135 in the client's catalogue. */
  Legend = "legend",
  /** Badge 134. */
  Hero = "hero",
}

const MANEUVERS_BADGE_ID: Record<ManeuversBadge, number> = {
  [ManeuversBadge.Legend]: 135,
  [ManeuversBadge.Hero]: 134,
};

/** A Maneuvers badge's own art, from the wot.assets mirror (the client ships
 * it at 24, 48 and 80 pixels). */
export function maneuversBadgeIconUrl(badge: ManeuversBadge, size: 24 | 48 | 80 = 48): string {
  return iconUrl(`library/badges/${size}x${size}/badge_${MANEUVERS_BADGE_ID[badge]}.png`);
}
