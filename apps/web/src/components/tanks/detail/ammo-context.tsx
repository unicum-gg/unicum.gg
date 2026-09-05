"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The round the page is answering for, shared by the two places that pick one.
 *
 * The hero's armour views and the Ammunition panel are asking the same
 * question, from either end of the page: what happens when this shell meets
 * this plate. Picked in one and not the other, the page reads a tank shooting
 * AP in the panel and HEAT on the vehicle above it.
 *
 * **Held as the shell itself and not as an index**, because the two lists are
 * not the same list. The panel offers what the mounted gun loads; the hero
 * offers only rounds that published the calibre, normalisation and ricochet
 * angle its rules need, and drops the rest rather than guess at them. Index 2
 * of one is not index 2 of the other, and on a gun with a round missing it is
 * not even the same kind.
 */
export type AmmoPick = {
  /** The client's own name for the kind: `ARMOR_PIERCING`, `HOLLOW_CHARGE`. */
  kind: string;
  damage: number | null;
  penetration: number;
  /**
   * Which of several rounds the three figures above cannot tell apart.
   *
   * A gun can list two rounds of one kind with the same damage and the same
   * penetration, differing only in name or price. Matched on the figures alone
   * the second of such a pair is unreachable: picking it matches the first,
   * which republishes the first, and the highlight walks back on every click.
   */
  nth?: number;
};

/** What either end needs of a round to be matched against a pick. */
type Round = {
  kind: string;
  damage: number | null;
  penetration: number;
};

type Choice = {
  picked: AmmoPick | null;
  choose: (next: AmmoPick | null) => void;
};

const AmmoChoice = createContext<Choice>({ picked: null, choose: () => {} });

/**
 * Which round of a list a pick means, or null where it means none of them.
 *
 * **Kind first, then the closest of that kind.** A gun can load two rounds of
 * one kind, a standard and a premium HE, so the kind alone collapses them onto
 * whichever comes first. The two numbers tell them apart, and matching on the
 * pair exactly would be brittle instead: the panel reads its damage and
 * penetration from the mounted gun's module and the hero reads them from the
 * vehicle's published shell stats, which agree on the live client and need not
 * on a test one.
 */
export function matchRound<T extends Round>(
  picked: AmmoPick | null,
  rounds: T[],
): number {
  if (!picked) return -1;
  const distance = (one: Round) =>
    Math.abs((one.damage ?? 0) - (picked.damage ?? 0)) +
    Math.abs(one.penetration - picked.penetration);
  let best = -1;
  for (const [at, one] of rounds.entries()) {
    if (one.kind !== picked.kind) continue;
    if (best < 0 || distance(one) < distance(rounds[best]!)) best = at;
  }
  if (best < 0) return best;
  // Among the rounds this pick fits equally well, the one it counted itself as.
  // Absent or out of range on the other list, the first still answers.
  const tied = [...rounds.entries()].filter(
    ([, one]) => one.kind === picked.kind && distance(one) === distance(rounds[best]!),
  );
  return tied[picked.nth ?? 0]?.[0] ?? best;
}

/** How many rounds before this one it is indistinguishable from. */
export function rankOf<T extends Round>(rounds: T[], at: number): number {
  const one = rounds[at];
  if (!one) return 0;
  return rounds
    .slice(0, at)
    .filter(
      (other) =>
        other.kind === one.kind &&
        other.damage === one.damage &&
        other.penetration === one.penetration,
    ).length;
}

export function AmmoChoiceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState<AmmoPick | null>(null);
  // **Nothing happens when the pick has not changed.** Both ends publish what
  // they are showing rather than only what a reader just clicked, which is what
  // lets the panel carry a shared link's round up to the hero. Left to set state
  // every time, that publication would answer itself for ever.
  const choose = useCallback((next: AmmoPick | null) => {
    setPicked((held) =>
      held?.kind === next?.kind &&
      held?.damage === next?.damage &&
      held?.penetration === next?.penetration &&
      // **Which of a tied pair, too.** Left out, a pick that differed only in
      // this was read as the pick already held, so the second of two rounds a
      // gun lists identically could never be chosen: the click published, the
      // publication was discarded, and the highlight walked back to the first.
      // Absent counts as the first, so an end that has no opinion about ties
      // does not fight one that has.
      (held?.nth ?? 0) === (next?.nth ?? 0)
        ? held
        : next,
    );
  }, []);
  const value = useMemo(() => ({ picked, choose }), [picked, choose]);
  return <AmmoChoice.Provider value={value}>{children}</AmmoChoice.Provider>;
}

/**
 * The shared round, where the page provides one.
 *
 * Outside a provider it is inert rather than an error: the comparison page runs
 * four configurators side by side, and a round picked on one of them is a claim
 * about that build alone.
 */
export function useAmmoChoice(): Choice {
  return useContext(AmmoChoice);
}
