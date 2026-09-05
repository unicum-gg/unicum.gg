"use client";

import { useId } from "react";
import { DiscordLogoIcon, PlusIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { iconUrl } from "@unicum.gg/shared";
import type { ReserveOption } from "@/hooks/use-boost-console";
import { BoostReservesPicker } from "@/components/clans/detail/boost-reserves-picker";
import {
  clanViewHref,
  MANAGE_CLAN_VIEW,
} from "@/components/clans/detail/tabs";
import { BoostSchedulePreview } from "@/components/clans/detail/boost-schedule";
import {
  DAY_LABELS,
  browserTz,
  fromHHMM,
  tzLabel,
} from "@/components/clans/detail/boost-time";
import ROUTES from "@/constants/routes";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/login-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// A concrete, filled-in example rendered read-only, so a visitor sees exactly
// what the tool is (the real console, just disabled) rather than an abstract
// pitch. The reserves mirror the common Stronghold economic orders.
const SAMPLE_RESERVES: ReserveOption[] = [
  {
    type: "battlePayments",
    name: "Battle Payments",
    icon: iconUrl("orders/big/combatPayments.png"),
    bonusType: "to credits earned",
    durationSec: 7200,
    activeUntil: null,
    levels: [
      { level: 1, amount: 3, status: "ready_to_activate", percent: 75 },
      { level: 2, amount: 1, status: "ready_to_activate", percent: 150 },
    ],
  },
  {
    type: "militaryManeuvers",
    name: "Military Maneuvers",
    icon: iconUrl("orders/big/militaryExercises.png"),
    bonusType: "to Free Experience earned",
    durationSec: 7200,
    activeUntil: null,
    levels: [{ level: 1, amount: 2, status: "ready_to_activate", percent: 75 }],
  },
  {
    type: "tacticalTraining",
    name: "Tactical Training",
    icon: iconUrl("orders/big/tacticalTraining.png"),
    bonusType: "to Combat Experience earned",
    durationSec: 7200,
    activeUntil: null,
    levels: [{ level: 1, amount: 2, status: "ready_to_activate", percent: 75 }],
  },
];
const SAMPLE_PICKED = { battlePayments: 1 };
const START = "18:00";
const END = "22:00";

/**
 * The Manage tab for visitors and non-officers: the real console UI, rendered
 * disabled with a filled example, plus a login / not-an-officer note. Shown in
 * place of the live console when `canManage` is false.
 */
export function BoostConsolePreview({
  region,
  tag,
  loggedOut,
}: {
  region: Region;
  tag: string;
  /** Undefined while the console is still resolving who is watching: the teaser
   * shows immediately, and only its closing call to action waits until we know
   * whether to invite a login or explain the officer requirement. */
  loggedOut?: boolean;
}) {
  const uid = useId();
  const tz = browserTz();
  const scheduleReserves = SAMPLE_RESERVES.filter(
    (r) => r.type in SAMPLE_PICKED,
  ).map((r) => ({
    type: r.type,
    name: r.name,
    percent:
      r.levels.find(
        (l) => l.level === SAMPLE_PICKED[r.type as keyof typeof SAMPLE_PICKED],
      )?.percent ?? null,
  }));

  return (
    <>
      <PanelSeparator />
      <div className="screen-line-before screen-line-after grid md:grid-cols-2">
        <Panel screenLines={false}>
          <PanelHeader className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <PanelTitle className="flex items-center gap-2">
              Stronghold boosts
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                Officers
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="flex flex-col items-start gap-4">
            <p className="text-sm text-fd-muted-foreground">
              Each workflow activates its reserves during a time window, once
              enough members are in a live game session. Runs on your account, no
              need to be online. Add as many as you need.
            </p>
            <Button variant="secondary" disabled>
              <PlusIcon className="size-4" /> Add workflow
            </Button>
          </PanelContent>
        </Panel>
        <Panel screenLines={false} className="md:border-l-0">
          <PanelHeader className="flex min-h-14 items-center">
            <PanelTitle className="flex items-center gap-2">
              Discord notifications
              <DiscordLogoIcon className="size-5 text-fd-muted-foreground" />
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="flex flex-col items-start gap-4">
            <p className="max-w-2xl text-sm text-fd-muted-foreground">
              Get a Discord message in a channel you choose every time a boost
              fires, so the whole clan knows it is live.
            </p>
            <Button disabled>
              <DiscordLogoIcon className="size-4" /> Connect Discord
            </Button>
          </PanelContent>
        </Panel>
      </div>

      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value="Weekday evenings"
            readOnly
            disabled
            className="h-8 max-w-xs font-medium"
          />
          <div className="flex items-center gap-2">
            <Switch checked disabled id={`en-${uid}`} />
            <Label htmlFor={`en-${uid}`} className="text-sm">
              Enabled
            </Label>
          </div>
        </PanelHeader>

        <PanelContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                Active days
              </Label>
              <div className="flex gap-1">
                {DAY_LABELS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled
                    className="size-8 rounded-md bg-brand text-xs font-semibold text-white"
                  >
                    {d[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">From</Label>
              <Input type="time" value={START} disabled className="w-28" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">To</Label>
              <Input type="time" value={END} disabled className="w-28" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                Min online
              </Label>
              <Input type="number" value={10} disabled className="w-20" />
            </div>
          </div>

          <p className="-mt-2 text-xs text-fd-muted-foreground">
            Times are in {tzLabel(tz)}, your timezone.
          </p>

          <BoostReservesPicker
            reserves={SAMPLE_RESERVES}
            picked={SAMPLE_PICKED}
            tz={tz}
            uid={uid}
            onChange={() => {}}
            disabled
          />

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-fd-muted-foreground">
              Schedule preview
            </Label>
            <BoostSchedulePreview
              windowStart={fromHHMM(START)}
              windowEnd={fromHHMM(END)}
              blockMin={120}
              reserves={scheduleReserves}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border pt-4">
            <p className="text-sm text-fd-muted-foreground">
              Set your hours and reserves once; the boosts fire on time on their
              own, even when nobody is around to press the button.
            </p>
            {loggedOut === undefined ? null : loggedOut ? (
              <LoginButton
                callbackURL={clanViewHref(
                  ROUTES.CLAN(region, tag),
                  MANAGE_CLAN_VIEW,
                )}
              >
                <Button>Log in with Wargaming to set it up</Button>
              </LoginButton>
            ) : (
              <p className="text-sm text-fd-muted-foreground">
                Only an officer of this clan can set this up.
              </p>
            )}
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
