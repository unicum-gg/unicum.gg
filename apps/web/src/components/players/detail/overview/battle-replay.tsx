"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayIcon, PauseIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import { minimapUrl, projectPoint, readMotion, readReplay } from "@unicum.gg/shared";
import type { ReplayMotion } from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";

type Bounds = {
  bottomLeft: { x: number; z: number };
  upperRight: { x: number; z: number };
};

/** How often the drawing advances while playing, in battle seconds per second. */
const SPEED = 4;

/**
 * A battle replayed on its own minimap, read from the player's own file.
 *
 * **Nothing is uploaded and nothing is stored.** The file is opened in the
 * page, decrypted and inflated by the browser, and never leaves the machine.
 * That is not only a privacy line, it is what makes the feature possible at
 * all: a replay is 1.3 MB against the 10 KB of results the mod sends, it only
 * exists when the player left recording on, and 94.8% of a seventeen-month
 * corpus is already unplayable because the client that recorded it has been
 * patched away. Collecting them would be a storage decision with no way back.
 *
 * What it adds over playing the file in the game: the roster is already
 * resolved here, so a dot carries the name, the clan and the battle rating of
 * whoever it was, which the client cannot tell you and a bare viewer has no
 * way to know.
 *
 * The file is checked against the battle it is dropped on. A replay of a
 * different battle draws a convincing map of the wrong thing, so the id has to
 * agree before anything is drawn.
 */
export function BattleReplay({
  battleId,
  arenaId,
  mapImage,
  bounds,
  participants,
  highlightAccount,
  t,
}: {
  battleId: string;
  arenaId: string;
  mapImage: string | null;
  bounds: Bounds | null;
  participants: Participant[];
  highlightAccount?: number;
  t: TranslateFunction;
}) {
  const [motion, setMotion] = useState<ReplayMotion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  const open = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setMotion(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { blocks, stream } = await readReplay(bytes);
        const meta = blocks[0] as Record<string, unknown> | null;
        const results = Array.isArray(blocks[1]) ? blocks[1][0] : blocks[1];
        const id = (results as Record<string, unknown> | null)?.arenaUniqueID;
        // The id is the only thing that says this file is this battle. Without
        // the check a replay of another game draws a convincing map of the
        // wrong thing, with the right names beside it.
        if (id !== undefined && String(id) !== battleId) {
          setError(t("replay.wrong-battle", { map: String(meta?.mapName ?? "?") }));
          return;
        }
        if (stream.length === 0) {
          setError(t("replay.unfinished"));
          return;
        }
        const read = readMotion(stream);
        if (read.tracks.length === 0) {
          setError(t("replay.no-positions"));
          return;
        }
        setMotion(read);
        setAt(0);
        setPlaying(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [battleId, t],
  );

  useEffect(() => {
    if (!playing || !motion) return;
    let last = performance.now();
    const step = (now: number) => {
      const delta = ((now - last) / 1000) * SPEED;
      last = now;
      setAt((previous) => {
        const next = previous + delta;
        if (next >= motion.duration) {
          setPlaying(false);
          return motion.duration;
        }
        return next;
      });
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, motion]);

  const byId = new Map(participants.map((p) => [p.id, p]));

  return (
    <div className="space-y-3 px-4 py-3">
      {motion === null ? (
        <label
          className={cn(
            "border-border/60 hover:bg-foreground/5 flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed px-4 py-8 text-center transition-colors",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <UploadSimpleIcon className="text-muted-foreground size-6" />
          <span className="text-sm font-medium">
            {busy ? t("replay.reading") : t("replay.drop")}
          </span>
          <span className="text-muted-foreground max-w-prose text-xs">
            {t("replay.privacy")}
          </span>
          <input
            type="file"
            accept=".wotreplay"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void open(file);
            }}
          />
        </label>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded">
            <MinimapImage
              src={mapImage ?? minimapUrl(arenaId)}
              arenaId={arenaId}
              alt={arenaId}
              sizes="512px"
              className="h-full w-full object-cover"
            />
            {bounds
              ? motion.tracks.map((track) => {
                  const point = pointAt(track.points, at);
                  if (!point) return null;
                  // Only x and z: the minimap is a plan view, and y is
                  // height. A tank on a hill is at the same place on the map
                  // as one under it.
                  const where = projectPoint({ x: point[1], z: point[3] }, bounds);
                  const who = byId.get(track.id);
                  const mine =
                    who?.account !== undefined &&
                    who.account === highlightAccount;
                  return (
                    <span
                      key={track.id}
                      title={who?.player?.nickname ?? String(track.id)}
                      style={{ left: `${where.left}%`, top: `${where.top}%` }}
                      className={cn(
                        "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-black/50",
                        mine
                          ? "bg-amber-400 size-2.5"
                          : who?.team === 1
                            ? "bg-emerald-400"
                            : "bg-red-400",
                      )}
                    />
                  );
                })
              : null}
          </div>

          <div className="mx-auto flex max-w-lg items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? t("replay.pause") : t("replay.play")}
            >
              {playing ? (
                <PauseIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4" />
              )}
            </Button>
            <Slider
              value={[at]}
              min={0}
              max={Math.max(1, motion.duration)}
              step={0.5}
              onValueChange={([value]) => {
                setPlaying(false);
                setAt(value);
              }}
              className="flex-1"
            />
            <span className="text-muted-foreground w-16 text-end text-sm tabular-nums">
              {clock(at)} / {clock(motion.duration)}
            </span>
          </div>
          {!bounds ? (
            <p className="text-muted-foreground text-center text-xs">
              {t("replay.no-bounds")}
            </p>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Where a vehicle was at `at` seconds.
 *
 * The last point at or before the instant, found by walking back: a track
 * holds only the moments it moved, so between two of them a vehicle is exactly
 * where it stopped. Interpolating would draw it gliding through walls.
 */
function pointAt(
  points: [number, number, number, number][],
  at: number,
): [number, number, number, number] | null {
  let found: [number, number, number, number] | null = null;
  for (const point of points) {
    if (point[0] > at) break;
    found = point;
  }
  return found;
}
