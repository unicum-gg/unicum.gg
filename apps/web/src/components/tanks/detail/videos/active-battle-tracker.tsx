"use client";

import { useEffect } from "react";
import { useMediaStore, type MediaPlayerInstance } from "@vidstack/react";
import type { RefObject } from "react";
import type { TankVideoCardData } from "./card";
import { activeBattleAt } from "./group";

/**
 * Follows the playhead and publishes the battle it is inside.
 *
 * Mounted beside the player rather than in the lists: the store subscription is
 * taken on the first render, and a card exists long before anything plays, so
 * one taken there would watch a ref that is still null and never fire. Renders
 * nothing, so only this component re-renders on the clock.
 */
export function ActiveBattleTracker({
  playerRef,
  battles,
  onActive,
}: {
  playerRef: RefObject<MediaPlayerInstance | null>;
  battles: TankVideoCardData[];
  onActive?: (id: number | null) => void;
}) {
  const { currentTime } = useMediaStore(playerRef);
  const active = activeBattleAt(battles, currentTime);
  useEffect(() => {
    onActive?.(active);
  }, [active, onActive]);
  return null;
}
