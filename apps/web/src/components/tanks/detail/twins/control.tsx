"use client";

import type { ReactNode } from "react";
import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";
import { useTwinsParam } from "@/hooks/use-twins-param";

enum TwinsScope {
  Own = "own",
  Twins = "twins",
}

/**
 * The switch between this vehicle alone and this vehicle with its twins.
 *
 * Every panel that offers it reads the same `?twins=` (see `useTwinsParam`), so
 * flipping it on one tab carries to the next and a link keeps the reading.
 */
export function TwinsControl({
  players,
  combinedPlayers,
}: {
  /** Players on this vehicle alone, for the first segment's tally. */
  players?: number;
  /** Players on this vehicle and its twins, for the second one's. */
  combinedPlayers?: number;
}) {
  const { t } = useTranslation("components/tanks/detail/twins/control");
  const [on, setOn] = useTwinsParam();
  return (
    <SegmentedControl
      active={on ? TwinsScope.Twins : TwinsScope.Own}
      onSelect={(next) => setOn(next === TwinsScope.Twins)}
      segments={[
        { id: TwinsScope.Own, label: t("own"), count: players },
        { id: TwinsScope.Twins, label: t("with-twins"), count: combinedPlayers },
      ]}
    />
  );
}

/**
 * Both readings, one of them hidden. Rendered together on the server because
 * the page is static and cannot see the URL, so a reader or a crawler landing
 * on `?twins=1` still has every figure in the HTML.
 */
export function TwinsView({
  own,
  combined,
}: {
  own: ReactNode;
  combined: ReactNode;
}) {
  const [on] = useTwinsParam();
  return (
    <>
      <div hidden={on}>{own}</div>
      <div hidden={!on}>{combined}</div>
    </>
  );
}
