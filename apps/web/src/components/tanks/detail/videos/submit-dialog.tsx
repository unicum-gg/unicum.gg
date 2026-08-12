"use client";

import { useMemo, useState } from "react";
import { mutate } from "swr";
import {
  BattleResult,
  formatTimestamp,
  MapGameMode,
  parseTimestampInput,
  parseYoutubeUrl,
} from "@unicum.gg/shared";
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
import { VideoScrubber } from "./scrubber";

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
  const [url, setUrl] = useState(initial?.url ?? "");
  // Kept apart from the URL and shown as its own field. A link copied with
  // "start at current time" carries `?t=`, and most links are not: without a
  // field for it, forgetting silently files a three-hour VOD at second 0, which
  // is the one thing this feature exists to avoid.
  const [start, setStart] = useState(
    initial ? formatTimestamp(initial.startSeconds) : "",
  );
  const [startTouched, setStartTouched] = useState(Boolean(initial));
  const [battle, setBattle] = useState<BattleContext>(EMPTY_BATTLE);
  const [damage, setDamage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // The same parser the endpoint uses, so a bad link is caught before a round
  // trip. The server still validates: a client is not a gate.
  const ref = useMemo(() => (url.trim() ? parseYoutubeUrl(url) : null), [url]);
  // What the start field shows: whatever was typed, else the link's own `?t=`.
  const startValue =
    startTouched || !ref?.startSeconds
      ? start
      : formatTimestamp(ref.startSeconds);
  const startSeconds = parseTimestampInput(startValue);
  const startInvalid = startValue.trim() !== "" && startSeconds === null;
  // Not a blocker, a warning: a short review of the tank legitimately starts at
  // the beginning, so this says what will happen rather than refusing.
  const startMissing = Boolean(ref) && !startInvalid && !startSeconds;

  // The battle context is required, the combined damage included, so the button
  // says so by staying disabled rather than letting the endpoint reject a form
  // that looked complete. Only the start time is exempt, for the video that
  // opens on the battle.
  const complete =
    Boolean(ref) && !startInvalid && isBattleComplete(battle) && Boolean(damage);

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
      await unicum
        .region(region)
        .tanks(slug)
        .videosSuggest({
          url: url.trim(),
          startSeconds: startSeconds ?? 0,
          arenaId: battle.arenaId,
          mode: battle.mode as MapGameMode,
          spawnTeam: Number(battle.spawnTeam),
          result: battle.result as BattleResult,
          combinedDamage: Number(damage),
        });
      setDone(true);
      // The queued row is the receipt: it belongs in the list under the video
      // immediately, and on the player's seek bar, rather than after a reload.
      void mutate(ownVideosKey(region, slug));
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
    setUrl("");
    setStart("");
    setStartTouched(false);
    setBattle(EMPTY_BATTLE);
    setDamage("");
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
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">YouTube link</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…&t=1h05m30s"
                className="h-9 rounded-md border border-fd-border bg-transparent px-3 text-sm focus:border-fd-ring focus:outline-none"
              />
              {url.trim() && !ref && (
                <span className="text-xs text-red-500">
                  That is not a YouTube video link.
                </span>
              )}
            </label>

            {/* The preview is the timestamp field: scrub to where the battle
                starts instead of going back to YouTube to read the clock. The
                text input stays, for pasting a time someone already has. */}
            {ref && (
              <VideoScrubber
                videoId={ref.videoId}
                seconds={startSeconds ?? 0}
                onChange={(s) => {
                  setStartTouched(true);
                  setStart(formatTimestamp(s));
                }}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  Battle starts at{" "}
                  <span className="font-normal text-fd-muted-foreground">
                    (optional)
                  </span>
                </span>
                <input
                  type="text"
                  value={startValue}
                  onChange={(e) => {
                    setStartTouched(true);
                    setStart(e.target.value);
                  }}
                  placeholder="1:05:30"
                  inputMode="numeric"
                  className="h-9 rounded-md border border-fd-border bg-transparent px-3 text-sm focus:border-fd-ring focus:outline-none"
                />
                {startInvalid ? (
                  <span className="text-xs text-red-500">
                    Use a time like 1:05:30, or leave it empty.
                  </span>
                ) : startMissing ? (
                  <span className="text-xs text-amber-500">
                    Your link has no timestamp. Scrub the preview above to the
                    battle, or leave it if the video starts on it.
                  </span>
                ) : null}
              </label>

              {/* Beside the start time rather than with the battle context below:
                both are numbers read off the same after-battle screen, and both
                are the submitter's own account of it. */}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Combined damage</span>
                <input
                  type="text"
                  value={damage}
                  onChange={(e) =>
                    setDamage(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="3450"
                  inputMode="numeric"
                  className="h-9 rounded-md border border-fd-border bg-transparent px-3 text-sm focus:border-fd-ring focus:outline-none"
                />
                <span className="text-xs text-fd-muted-foreground">
                  Damage dealt plus assisted.
                </span>
              </label>
            </div>

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
