"use client";

import { useEffect } from "react";
import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import { SubmitTacticDialog } from "@/components/maps/detail/videos/submit-dialog";
import { useTankVideoPlayer } from "@/components/tanks/detail/videos/player";
import { unicum } from "@/services/sdk";

type MapSeed = { arenaId: string; slug: string; name: string };

/**
 * The tactic form, wired to the clan's player.
 *
 * A tactic is still filed under the ground it was fought on, not under the
 * clan: this only moves where it can be suggested from. Someone watching a
 * clan's evening and spotting the moment worth linking should not have to work
 * out which map page to open first.
 *
 * The form is seeded with the map of the battle being watched, which the form
 * then lets the submitter change, exactly as on a map page: a competitive VOD
 * runs through a rotation, so the moment two battles later is on other ground.
 *
 * The seed comes from the map catalogue, read under the key the form itself
 * uses, so it costs no request of its own. Until it lands there is nothing to
 * seed with, and the form stays out of the page rather than opening on the
 * wrong map.
 */
export function ClanTacticDialogSlot({ region }: { region: Region }) {
  const player = useTankVideoPlayer();
  const { data: maps } = useSWR(`maps:${region}`, () =>
    unicum
      .region(region)
      .maps.list()
      .then((r) => r.results as unknown as MapSeed[]),
  );

  // The battle being watched, or the first of the list before one is opened:
  // either way the map most likely to be the right one.
  const watching = player?.current ?? player?.videos[0] ?? null;
  const seed = maps?.find((m) => m.slug === watching?.mapSlug) ?? null;

  // Registered only while the form is actually on the page, so the player's
  // "Suggest this moment" never offers a click that lands nowhere.
  const register = player?.registerForm;
  const ready = seed !== null;
  useEffect(() => (ready ? register?.() : undefined), [ready, register]);

  if (!seed) return null;

  const suggestion = player?.suggestion ?? null;
  return (
    <SubmitTacticDialog
      // Remounted on each moment picked in the player, so the form opens
      // already filled in rather than an effect racing its own fields.
      key={suggestion ? `${suggestion.url}@${suggestion.startSeconds}` : "blank"}
      region={region}
      map={seed}
      initial={suggestion ?? undefined}
    />
  );
}
