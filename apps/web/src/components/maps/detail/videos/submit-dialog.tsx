"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  BATTLE_FORMAT_LABEL,
  BattleFormat,
  BattleResult,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  isCompetitiveFormat,
  MapGameMode,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { UnicumError } from "@unicum.gg/sdk";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/login-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BattleFields,
  EMPTY_BATTLE,
  isBattleComplete,
  type BattleContext,
} from "@/components/tanks/detail/videos/battle-fields";
import {
  ownVideosKey,
  type TankVideoSuggestion,
} from "@/components/tanks/detail/videos/player";
import {
  useVideoSource,
  VideoSourceFields,
  VIDEO_FORM_INPUT,
} from "@/components/tanks/detail/videos/source-fields";
import ROUTES from "@/constants/routes";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";

/** The formats a tactic is filed under. Random is absent on purpose: a random
 * battle is about the vehicle it was played in, so it is suggested from that
 * tank's page, where the vehicle is already known and does not have to be
 * picked out of a catalogue of twelve hundred. */
const TACTIC_FORMATS = Object.values(BattleFormat).filter(isCompetitiveFormat);

/**
 * The endpoint's own name for what went wrong, out of the body it answers with.
 *
 * Read rather than inferred from the status: the suggest endpoint answers 404
 * for four different things (submissions unconfigured, an unknown map, an
 * unknown tank, an unknown clan tag), and the clan field is filled by default
 * on a clan's page, so guessing from the status told a submitter standing on
 * [FAME]'s page that we do not track [FAME].
 */
function errorCode(err: unknown): string | null {
  if (!(err instanceof UnicumError)) return null;
  const body = err.body;
  if (typeof body !== "object" || body === null) return null;
  const code = (body as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

/**
 * Suggest a tactic for this map.
 *
 * The mirror of the tank page's form: there the vehicle is implied and the map
 * is asked for, here the map is implied and what is asked for is the format,
 * the side and, when the format does not fix them, the size and the tier.
 *
 * No combined damage, and no vehicle. A tactic is a team's plan for a piece of
 * ground: one player's damage is not what anyone is looking it up by, and the
 * tank the camera happened to sit in would file the plan under the wrong thing.
 */
export function SubmitTacticDialog({
  region,
  map,
  clanTag: creditedClan,
  initial,
}: {
  region: Region;
  /** The map the form starts on, and the one it names when a suggestion lands
   * somewhere else. Only these three fields, so a page holding no map detail
   * of its own (a clan's videos) can seed it from the catalogue: a `MapDetail`
   * satisfies it as it is. */
  map: { arenaId: string; slug: string; name: string };
  /**
   * The clan the credit starts on, when the form was opened from one: a tactic
   * suggested from a clan's page is about that clan, and leaving the field
   * blank filed it under nobody, so it never reached the page it was suggested
   * from. A seed, not a lock, exactly like the map above: the field stays
   * editable, since the clan on screen is not always the one that played.
   */
  clanTag?: string;
  /**
   * A moment picked in the player, which opens the form on it.
   *
   * Consumed as initial state rather than watched, and the caller remounts this
   * component on a new one (`key`), so opening never needs an effect racing the
   * fields it fills. Only the video and the second come across: the format, the
   * side and the outcome belong to the battle, not to the video, so they are
   * the part still worth asking for.
   */
  initial?: TankVideoSuggestion;
}) {
  const { data: session } = useSession();
  // Back to where the form was opened, which is not always this map's page: the
  // clan tab mounts it too, and bouncing someone to a map they never asked for
  // after a login is a strange way to answer "log in to suggest".
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const backTo = search ? `${pathname}?${search}` : pathname;
  const [open, setOpen] = useState(Boolean(initial));
  const source = useVideoSource(initial);
  // Seeded with the page's map, not fixed to it. A competitive VOD runs through
  // a rotation, so the second battle in it is on other ground: filing it under
  // the page someone happened to open would be silently wrong.
  const [battle, setBattle] = useState<BattleContext>(() => ({
    ...EMPTY_BATTLE,
    arenaId: map.arenaId,
  }));
  const [format, setFormat] = useState<string>("");
  const [clanTag, setClanTag] = useState(creditedClan ?? "");
  const [teamSize, setTeamSize] = useState("");
  const [tier, setTier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // The catalogue `BattleFields` already fetches, under the same SWR key, so
  // this costs no second request. Only the picked map is read from it: the form
  // has to be able to say where the suggestion went.
  const { data: maps } = useSWR(`maps:${region}`, () =>
    unicum
      .region(region)
      .maps.list()
      .then((r) => r.results as unknown as { arenaId: string; slug: string; name: string }[]),
  );
  const filedOn = maps?.find((m) => m.arenaId === battle.arenaId) ?? null;

  const picked = format ? (format as BattleFormat) : null;
  // The format answers these where it fixes them, so the fields only appear
  // where the submitter is the only source.
  const fixedSize = picked ? FORMAT_TEAM_SIZE[picked] : undefined;
  const fixedTier = picked ? FORMAT_TIER[picked] : undefined;

  const complete =
    source.ok &&
    isBattleComplete(battle) &&
    Boolean(format) &&
    (fixedSize !== undefined || Boolean(teamSize)) &&
    (fixedTier !== undefined || Boolean(tier));

  function reset() {
    source.reset();
    setBattle({ ...EMPTY_BATTLE, arenaId: map.arenaId });
    setFormat("");
    setClanTag(creditedClan ?? "");
    setTeamSize("");
    setTier("");
    setError(null);
    setDone(false);
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
        format: format as BattleFormat,
        teamSize: teamSize ? Number(teamSize) : undefined,
        tier: tier ? Number(tier) : undefined,
        clanTag: clanTag.trim() || undefined,
      });
      setDone(true);
      // The queued row is the receipt: it belongs in the list under the video
      // immediately, and on the player's seek bar, rather than after a reload.
      void mutate(ownVideosKey(region));
    } catch (err) {
      const status = err instanceof UnicumError ? err.status : 0;
      if (status === 409) {
        setError("That battle has already been suggested.");
      } else if (status === 422) {
        setError("YouTube won't show that video (private, deleted or blocked).");
      } else if (errorCode(err) === "clan_not_found") {
        setError(`We don't track a clan tagged [${clanTag.trim()}] on ${region.toUpperCase()}.`);
      } else {
        setError("Something went wrong. Try again in a moment.");
      }
    } finally {
      setSending(false);
    }
  }

  if (!session?.user) {
    return (
      <LoginButton callbackURL={backTo}>
        <Button variant="outline" size="sm">
          Log in to suggest a tactic
        </Button>
      </LoginButton>
    );
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
          Suggest a tactic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{done ? "Suggestion sent" : "Suggest a tactic"}</DialogTitle>
          <DialogDescription>
            {done ? (
              // Named, because the map is a field: a clan evening runs through
              // a rotation, so a suggestion sent from one map page regularly
              // belongs to another, and leaving someone to guess where their
              // own row went is the thing this line exists to prevent.
              <>
                It is in the queue, and shows up{" "}
                {filedOn && filedOn.slug !== map.slug ? (
                  <>
                    on{" "}
                    <Link
                      href={ROUTES.MAP(region, filedOn.slug)}
                      className="text-brand hover:underline"
                    >
                      {filedOn.name}
                    </Link>
                  </>
                ) : (
                  "here"
                )}{" "}
                once a moderator has looked at it. Yours is greyed out on that
                page in the meantime.
              </>
            ) : (
              `A competitive battle, opening at the second it starts. The map starts on ${map.name} and moves with the video: a clan evening runs through a rotation. The side it was played from is the part a shot-caller looks it up by, so it is asked for rather than guessed.`
            )}
          </DialogDescription>
        </DialogHeader>

        {done ? null : (
          <div className="flex flex-col gap-3">
            <VideoSourceFields source={source} />

            {/* Where it was played, map included: a competitive VOD runs
                through a rotation, so the battle being watched is not always on
                the map whose page the form was opened from. Seeded with it,
                changeable from it. */}
            <BattleFields
              region={region}
              value={battle}
              onChange={(patch) => setBattle((b) => ({ ...b, ...patch }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Format</span>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="What was played" />
                  </SelectTrigger>
                  <SelectContent>
                    {TACTIC_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {BATTLE_FORMAT_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {/* Only where the format leaves them open: Clan Wars and Advances
                  are tier X fifteens and Onslaught a tier X seven, so asking
                  would be asking someone to retype a rule. */}
              {picked && fixedSize === undefined && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Players per team</span>
                  <input
                    type="text"
                    value={teamSize}
                    onChange={(e) =>
                      setTeamSize(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="7"
                    inputMode="numeric"
                    className={VIDEO_FORM_INPUT}
                  />
                </label>
              )}
              {picked && fixedTier === undefined && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Tier</span>
                  <input
                    type="text"
                    value={tier}
                    onChange={(e) =>
                      setTier(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="10"
                    inputMode="numeric"
                    className={VIDEO_FORM_INPUT}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  Clan{" "}
                  <span className="font-normal text-fd-muted-foreground">
                    (optional)
                  </span>
                </span>
                <input
                  type="text"
                  value={clanTag}
                  onChange={(e) => setClanTag(e.target.value)}
                  placeholder="FAME"
                  className={VIDEO_FORM_INPUT}
                />
                <span className="text-xs text-fd-muted-foreground">
                  Credited on the clan&apos;s own page.
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
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
