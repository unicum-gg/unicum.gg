"use client";

import { useState } from "react";
import { mutate } from "swr";
import { BattleFormat, BattleResult, MapGameMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UnicumError } from "@unicum.gg/sdk";
import ROUTES from "@/constants/routes";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";
import {
  BattleFields,
  EMPTY_BATTLE,
  isBattleComplete,
  type BattleContext,
} from "./battle-fields";
import { ownVideosKey, type TankVideoSuggestion } from "./player";
import {
  useVideoSource,
  VideoSourceFields,
  VIDEO_FORM_INPUT,
} from "./source-fields";

/**
 * Suggest a video for this tank.
 *
 * Holds the video itself: the link, the second the battle starts, and the
 * numbers read off the after-battle screen. Where it was played is
 * `BattleFields`, which owns the map catalogue and the spawn geometry that goes
 * with it.
 */
export function SubmitVideoDialog({
  region,
  slug,
  initial,
}: {
  region: Region;
  slug: string;
  /**
   * A moment picked in the hero player, which opens the form on it.
   *
   * Consumed as initial state rather than watched, and the caller remounts this
   * component on a new one (`key`), so opening never needs an effect racing the
   * fields it fills. Only the video and the second come across: the map, the
   * mode and the outcome belong to the battle, not to the video, so they are
   * the part still worth asking for.
   */
  initial?: TankVideoSuggestion;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(Boolean(initial));
  const source = useVideoSource(initial);
  const [battle, setBattle] = useState<BattleContext>(EMPTY_BATTLE);
  const [damage, setDamage] = useState("");
  const [assists, setAssists] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // The battle context is required, the combined damage included, so the button
  // says so by staying disabled rather than letting the endpoint reject a form
  // that looked complete. Only the start time is exempt, for the video that
  // opens on the battle.
  const complete = source.ok && isBattleComplete(battle) && Boolean(damage);

  if (!session?.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href={ROUTES.AUTH_SIGN_IN(region, ROUTES.TANK(region, slug))}>
          Log in to suggest a video
        </a>
      </Button>
    );
  }

  async function submit() {
    setSending(true);
    setError(null);
    try {
      await unicum.region(region).videosSuggest({
        url: source.url.trim(),
        startSeconds: source.seconds ?? 0,
        arenaId: battle.arenaId,
        mode: battle.mode as MapGameMode,
        spawnTeam: Number(battle.spawnTeam),
        result: battle.result as BattleResult,
        // This dialog is the tank page's, so it files random battles: the
        // vehicle is the page it was opened from, and the damage is what makes
        // two of them comparable.
        format: BattleFormat.Random,
        tankSlug: slug,
        // Two figures on the after-battle screen, one number in the row: the
        // card and the filters compare a single combined value, so the split is
        // summed back here. Assists left blank counts as none.
        combinedDamage: Number(damage) + (assists ? Number(assists) : 0),
      });
      setDone(true);
      // The queued row is the receipt: it belongs in the list under the video
      // immediately, and on the player's seek bar, rather than after a reload.
      void mutate(ownVideosKey(region));
    } catch (err) {
      // The SDK throws `UnicumError` on a non-2xx, carrying the status, so the
      // two cases worth naming are still distinguishable.
      const status = err instanceof UnicumError ? err.status : 0;
      if (status === 409) {
        setError("That battle has already been suggested.");
      } else if (status === 422) {
        setError(
          "YouTube won't show that video (private, deleted or blocked).",
        );
      } else {
        setError("Something went wrong. Try again in a moment.");
      }
    } finally {
      setSending(false);
    }
  }

  /**
   * Blank slate for the next suggestion.
   *
   * Run on OPEN, not on close: closing happens through several paths (the
   * footer button, Escape, a click outside) and only some of them go through
   * `onOpenChange`, so resetting there left the success screen up and the
   * dialog offering nothing but "Close" forever. Opening is the one moment that
   * always happens, and it is also when the state matters.
   *
   * The fields are cleared too, not just the outcome: a second suggestion
   * pre-filled with the first would be refused as a duplicate.
   */
  function reset() {
    source.reset();
    setBattle(EMPTY_BATTLE);
    setDamage("");
    setAssists("");
    setError(null);
    setDone(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Suggest a video
        </Button>
      </DialogTrigger>
      {/* Wider and scrollable: the preview is a 16:9 player above five fields,
          which the primitive's default size cannot hold.
          The `sm:` prefix is load-bearing, since the primitive caps itself with
          `sm:max-w-md`, so a plain `max-w-*` here loses to it above 640px and
          the dialog stays 448px wide however large the value. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {/* The header follows the state instead of standing above it. Left
            fixed, the instructions for a form that is no longer on screen sat
            over the confirmation, and the two competed to be read. The
            description slot is the same element either way, which is what
            `aria-describedby` points at. */}
        <DialogHeader>
          <DialogTitle>
            {done ? "Suggestion sent" : "Suggest a video"}
          </DialogTitle>
          <DialogDescription>
            {done
              ? "It is in the queue, and shows up on this tab once a moderator has looked at it."
              : "Paste a YouTube link, then set the exact moment the battle starts. Everyone who opens it lands on that second, so a suggestion whose timestamp is off is turned down in review."}
          </DialogDescription>
        </DialogHeader>

        {done ? null : (
          <div className="flex flex-col gap-3">
            <VideoSourceFields source={source}>
              {/* Beside the start time rather than with the battle context
                  below: all three are numbers read off the same after-battle
                  screen, and the submitter's own account of it. Split into the
                  two figures that screen shows, summed into the row's one
                  combined value at submit. */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Damage</span>
                  <input
                    type="text"
                    value={damage}
                    onChange={(e) =>
                      setDamage(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="3450"
                    inputMode="numeric"
                    className={VIDEO_FORM_INPUT}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">
                    Assists{" "}
                    <span className="font-normal text-fd-muted-foreground">
                      (optional)
                    </span>
                  </span>
                  <input
                    type="text"
                    value={assists}
                    onChange={(e) =>
                      setAssists(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="1200"
                    inputMode="numeric"
                    className={VIDEO_FORM_INPUT}
                  />
                </label>
              </div>
            </VideoSourceFields>

            <BattleFields
              region={region}
              value={battle}
              onChange={(patch) => setBattle((b) => ({ ...b, ...patch }))}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
              {/* Suggesting one usually means having a second in mind, and the
                  form is right here, so offer it rather than making them close
                  and reopen. */}
              <Button variant="outline" onClick={reset}>
                Suggest another
              </Button>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </>
          ) : (
            <Button onClick={submit} disabled={!complete || sending}>
              {sending ? "Sending…" : "Suggest"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
