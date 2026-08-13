"use client";

import { useEffect } from "react";
import type { MapDetail } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { useTankVideoPlayer } from "@/components/tanks/detail/videos/player";
import { SubmitTacticDialog } from "./submit-dialog";

/**
 * The tactic form, wired to the map's player.
 *
 * "Suggest this moment" in the player hands over a video and a second, and this
 * remounts the form on them so it opens already filled in. The remount is the
 * point: the form holds a dozen fields and a loaded player, and a fresh mount
 * is the one way to seed all of it at once without an effect racing whatever
 * the previous suggestion left behind.
 *
 * Its own trigger button still works the usual way, from a blank slate.
 */
export function SubmitTacticDialogSlot({
  region,
  map,
}: {
  region: Region;
  map: MapDetail;
}) {
  // Registers with the player, which only offers "Suggest this moment" where
  // something is listening for it.
  const player = useTankVideoPlayer();
  const register = player?.registerForm;
  useEffect(() => register?.(), [register]);

  const suggestion = player?.suggestion ?? null;

  return (
    <SubmitTacticDialog
      key={
        suggestion ? `${suggestion.url}@${suggestion.startSeconds}` : "blank"
      }
      region={region}
      map={map}
      initial={suggestion ?? undefined}
    />
  );
}
