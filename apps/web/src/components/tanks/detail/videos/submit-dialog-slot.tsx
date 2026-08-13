"use client";

import { useEffect } from "react";
import type { Region } from "@unicum.gg/wargaming";
import { useTankVideoPlayer } from "./player";
import { SubmitVideoDialog } from "./submit-dialog";

/**
 * The suggestion form, wired to the hero player.
 *
 * "Suggest this moment" in the player hands over a video and a second, and this
 * remounts the form on them so it opens already filled in. The remount is the
 * point: the form holds a dozen fields and a loaded player, and a fresh mount
 * is the one way to seed all of it at once without an effect racing whatever
 * the previous suggestion left behind.
 *
 * Its own trigger button still works the usual way, from a blank slate.
 */
export function SubmitVideoDialogSlot({
  region,
  slug,
}: {
  region: Region;
  slug: string;
}) {
  const player = useTankVideoPlayer();
  const suggestion = player?.suggestion ?? null;

  // Registers with the player, which only offers "Suggest this moment" where
  // something is listening for it.
  const register = player?.registerForm;
  useEffect(() => register?.(), [register]);

  return (
    <SubmitVideoDialog
      key={
        suggestion ? `${suggestion.url}@${suggestion.startSeconds}` : "blank"
      }
      region={region}
      slug={slug}
      initial={suggestion ?? undefined}
    />
  );
}
