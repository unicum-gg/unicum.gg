"use client";

import { useTranslation } from "@/hooks/use-translation";
import { useState } from "react";
import { mutate } from "swr";
import {
  BattleFormat,
  BattleResult,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  isCompetitiveFormat,
  MapGameMode,
  TankVideoStatus,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClanField,
  TankField,
  type ClanPick,
} from "@/components/videos/picker-field";
import {
  BattleFields,
  isBattleComplete,
  type BattleContext,
} from "@/components/tanks/detail/videos/battle-fields";
import { ownVideosKey } from "@/components/videos/own-videos-key";
import {
  useVideoSource,
  VideoSourceFields,
  VIDEO_FORM_INPUT,
} from "@/components/tanks/detail/videos/source-fields";
import { apiErrorCode, apiErrorStatus } from "@/lib/api-error";
import { unicum } from "@/services/sdk";
// Type-only, so nothing from the server stack reaches the browser bundle: the
// shape is the endpoint's own, and restating it here would be a second place to
// keep in step with the row it comes from.
import type { EditableVideo as StoredVideo } from "@unicum.gg/core/tanks/videos-read";

/** The suggestion as the endpoint answers with it: everything the form edits,
 * and not who submitted it, which is settled before the row is handed over and
 * is nobody's business afterwards. */
export type EditableVideo = Omit<StoredVideo, "submittedBy">;

/**
 * The form that corrects a suggestion.
 *
 * Every field of the two submission forms in one, because an edit cannot know
 * which of them the row came through, and because the correction is often the
 * move between them: a tactic filed as a random battle, or the reverse. The
 * vehicle is here for the same reason and is the field this whole page exists
 * for, since neither form asks for it (each implies it from the page it was
 * opened on, which is exactly how a battle ends up under the wrong tank).
 *
 * Mounted with the row already loaded, so every field starts on what is stored
 * rather than filling in from an effect a keystroke could race.
 */
export function VideoEditFields({
  region,
  video,
  token,
  onDone,
}: {
  region: Region;
  video: EditableVideo;
  /** A moderator's signed link. Absent when the author is correcting their own,
   * who is identified by their session. */
  token?: string;
  /** Closes the dialog this sits in, once there is nothing left to say. */
  onDone: () => void;
}) {
  const { t } = useTranslation("components/videos/edit-fields");
  const { t: tGame } = useTranslation("game/vocabulary");
  const source = useVideoSource({
    url: video.url,
    startSeconds: video.startSeconds,
  });
  const [battle, setBattle] = useState<BattleContext>({
    arenaId: video.arenaId ?? "",
    mode: video.mode ?? "",
    spawnTeam: video.spawnTeam ? String(video.spawnTeam) : "",
    result: video.result ?? "",
  });
  const [format, setFormat] = useState<BattleFormat>(video.format);
  const [tank, setTank] = useState<{ slug: string; name: string } | null>(
    video.tankSlug ? { slug: video.tankSlug, name: video.tankName ?? video.tankSlug } : null,
  );
  // The stored figure is already the sum of damage and assists, so it is edited
  // as the one number it is: splitting it back in two would ask someone to
  // remember a breakdown the row never kept.
  const [combined, setCombined] = useState(
    video.combinedDamage === null ? "" : String(video.combinedDamage),
  );
  const [teamSize, setTeamSize] = useState(
    video.teamSize === null ? "" : String(video.teamSize),
  );
  const [tier, setTier] = useState(video.tier === null ? "" : String(video.tier));
  const [clan, setClan] = useState<ClanPick | null>(
    video.clan
      ? {
          tag: video.clan.tag,
          color: video.clan.color,
          emblem: video.clan.emblem,
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const competitive = isCompetitiveFormat(format);
  const fixedSize = FORMAT_TEAM_SIZE[format];
  const fixedTier = FORMAT_TIER[format];
  // The two fields the format decides the existence of, named once so the
  // inputs below and the body above cannot disagree about them.
  const showsTeamSize = competitive && fixedSize === undefined;
  const showsTier = competitive && fixedTier === undefined;
  // A random battle has nowhere to live without its vehicle, and the endpoint
  // says so; the button says it first by staying disabled.
  const complete =
    source.ok &&
    isBattleComplete(battle) &&
    (competitive || (Boolean(tank) && Boolean(combined)));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await unicum.region(region).videosEdit({
        id: video.id,
        token,
        url: source.url.trim(),
        startSeconds: source.seconds ?? 0,
        arenaId: battle.arenaId,
        mode: battle.mode as MapGameMode,
        spawnTeam: Number(battle.spawnTeam),
        result: battle.result as BattleResult,
        format,
        tankSlug: tank?.slug,
        combinedDamage: competitive || !combined ? undefined : Number(combined),
        // Only where the format still offers them. The inputs disappear when it
        // stops, but their state does not, so a Skirmish corrected into a random
        // battle would otherwise send the tier it used to be fought at, and the
        // endpoint stores whatever a random battle is sent.
        teamSize: showsTeamSize && teamSize ? Number(teamSize) : undefined,
        tier: showsTier && tier ? Number(tier) : undefined,
        clanTag: clan?.tag,
      });
      setSaved(true);
      // The author's own queue is what shows a pending row on the pages it
      // belongs to, so it has to hear about a correction that moved one.
      void mutate(ownVideosKey(region));
    } catch (err) {
      const status = apiErrorStatus(err);
      const code = apiErrorCode(err);
      if (status === 409) {
        setError("That battle is already in the queue or on the site.");
      } else if (status === 422) {
        setError("YouTube won't show that video (private, deleted or blocked).");
      } else if (status === 403) {
        setError(
          token
            ? "That link has expired. Press Edit again on the card in Discord."
            : "This suggestion is not yours to correct.",
        );
      } else if (code === "clan_not_found") {
        setError(
          `We don't track a clan tagged [${clan?.tag}] on ${region.toUpperCase()}.`,
        );
      } else {
        setError("Something went wrong. Try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {t("saved-it-is-in-the")}</p>
        <div className="flex justify-end">
          <Button onClick={onDone}>{t("close")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* First, above the fields it is about: someone who opens this form after
          a rejection is looking for what to change, and the answer is here
          rather than in the fields, which look exactly as they did when they
          were turned down. */}
      {video.status === TankVideoStatus.Rejected && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
          <p className="font-medium text-red-500">{t("turned-down")}</p>
          <p className="mt-0.5 whitespace-pre-line">
            {video.reviewNote?.trim() ||
              t("no-reason-recorded")}
          </p>
        </div>
      )}

      <VideoSourceFields source={source}>
        {!competitive && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("combined-damage")}</span>
            <input
              type="text"
              value={combined}
              onChange={(e) =>
                setCombined(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="4650"
              inputMode="numeric"
              className={VIDEO_FORM_INPUT}
            />
            <span className="text-xs text-fd-muted-foreground">
              {t("damage-dealt-plus-assisted-as")}</span>
          </label>
        )}
      </VideoSourceFields>

      <BattleFields
        region={region}
        value={battle}
        onChange={(patch) => setBattle((b) => ({ ...b, ...patch }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("format")}</span>
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as BattleFormat)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={t("what-was-played")} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BattleFormat).map((f) => (
                <SelectItem key={f} value={f}>
                  {tGame(`battle-formats.${f}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <TankField
          region={region}
          tank={tank}
          onPick={setTank}
          onClear={() => setTank(null)}
          required={!competitive}
        />

        {/* Only where the format leaves them open: Clan Wars and Advances are
            tier X fifteens and Onslaught a tier X seven, so a field for them
            would be a field for retyping a rule. */}
        {showsTeamSize && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("players-per-team")}</span>
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
        {showsTier && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("tier")}</span>
            <input
              type="text"
              value={tier}
              onChange={(e) => setTier(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="10"
              inputMode="numeric"
              className={VIDEO_FORM_INPUT}
            />
          </label>
        )}

        <ClanField
          region={region}
          clan={clan}
          onPick={setClan}
          onClear={() => setClan(null)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!complete || saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
