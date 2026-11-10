"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";
import { MANEUVERS_LIMIT } from "@/components/maneuvers/limit";

/** The board as the SDK hands it over, dates revived. */
export type ManeuversData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["maneuvers"]>
>;

type ManeuversEditionState = {
  region: Region;
  board: ManeuversData;
  /** The edition `?edition=` asks for, null for the newest. */
  requested: string | null;
  /** True while a past edition's boards are on their way. */
  loading: boolean;
};

const ManeuversEditionContext = createContext<ManeuversEditionState | null>(null);

/**
 * Owner of the edition a Maneuvers page shows, shared by its hero and its board
 * so the two always describe the same edition.
 *
 * The page renders the newest edition statically (ISR, like the Onslaught
 * board), and a past one is picked with `?edition=`, which a static page never
 * sees, so it is read here and that edition is fetched through the SDK. The
 * newest edition is the server's `initial`, derived rather than copied into
 * state.
 */
export function ManeuversEditionProvider({
  region,
  initial,
  children,
}: {
  region: Region;
  initial: ManeuversData;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const requested = params.get("edition");
  const isPast = Boolean(requested && requested !== initial.edition?.eventName);

  const [settled, setSettled] = useState<{
    id: string;
    data: ManeuversData | null;
  } | null>(null);

  useEffect(() => {
    if (!isPast || !requested) return;
    let cancelled = false;
    unicum
      .region(region)
      .maneuvers({ limit: MANEUVERS_LIMIT, edition: requested })
      .then((res) => {
        if (!cancelled) setSettled({ id: requested, data: res });
      })
      .catch(() => {
        if (!cancelled) setSettled({ id: requested, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isPast, requested, region]);

  const fetched = isPast && settled?.id === requested ? settled : null;
  // A failed fetch reads as an edition we do not hold rather than silently
  // falling back to the newest one under a picker naming another.
  const board: ManeuversData = !isPast
    ? initial
    : fetched?.data ?? {
        ...initial,
        edition: null,
        standing: null,
        players: [],
        clans: [],
      };

  return (
    <ManeuversEditionContext.Provider
      value={{
        region,
        board,
        requested: isPast ? requested : null,
        loading: isPast && !fetched,
      }}
    >
      {children}
    </ManeuversEditionContext.Provider>
  );
}

export function useManeuversEdition(): ManeuversEditionState {
  const state = useContext(ManeuversEditionContext);
  if (!state) {
    throw new Error("useManeuversEdition must be used inside ManeuversEditionProvider");
  }
  return state;
}
