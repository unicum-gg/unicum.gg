"use client";

import Image from "next/image";
import { CheckIcon } from "lucide-react";
import type { TankCrew as TankCrewData } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import {
  crewSkillField,
  MAX_MAJOR_PERKS,
  MIN_ROLE_LEVEL,
  REPAIR_SPEED_AT_FULL,
  type TankSpec,
} from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Human labels for the crew roles (WG role keys) and the characteristics a skill
// effect maps to, for the member headers and the effect tooltips.
const ROLE_LABEL: Record<string, string> = {
  commander: "Commander",
  gunner: "Gunner",
  driver: "Driver",
  loader: "Loader",
  radioman: "Radio Operator",
};

const FIELD_LABEL: Partial<Record<keyof TankSpec, string>> = {
  viewRange: "View range",
  dispMoving: "Dispersion on the move",
  accuracy: "Accuracy",
  aimTime: "Aim time",
  hullTraverse: "Hull traverse",
  turretTraverse: "Turret traverse",
  ammoRackHealth: "Ammo rack HP",
  shellVelocity: "Shell velocity",
  trackRepairTime: "Track repair time",
};

/** The signed percentage a skill effect applies to its characteristic at the
 * given training level. Aim time improves inversely to the (aim-speed) factor. */
function effectPercent(
  field: keyof TankSpec,
  value: number,
  level: number,
): number {
  const factor = value * level * 100;
  const rel = field === "aimTime" ? 1 / (1 + factor) - 1 : factor;
  return Math.round(rel * 1000) / 10;
}

// The camo gain from ONE crew member's Camouflage skill, vs no camo skill. The
// game averages the skill over the whole crew (`0.57 + 0.43 * camoLevel`, where
// camoLevel is the trained fraction), so a single member contributes `1 /
// crewSize` of the training. We show that per-member figure (what hovering this
// member's skill actually does), not the whole-crew total.
const CAMO_NO_SKILL = 0.57;
function camoPercent(level: number, crewSize: number): number {
  const l = level < 0 ? 0 : level > 1 ? 1 : level;
  const perMember = crewSize > 0 ? l / crewSize : l;
  return Math.round(((0.57 + 0.43 * perMember) / CAMO_NO_SKILL - 1) * 1000) / 10;
}

// The repair-time cut from ONE crew member's Repairs skill: like Camouflage it
// is crew-averaged, so a single member contributes `level / crewSize` to the
// effective repair level, and the time scales by `1 / (1 + 0.8 * r)`.
function repairPercent(level: number, crewSize: number): number {
  const r = crewSize > 0 ? level / crewSize : level;
  return Math.round((1 / (1 + REPAIR_SPEED_AT_FULL * r) - 1) * 1000) / 10;
}

function SkillTooltip({
  name,
  description,
  effects,
  crewLevel,
  camouflage,
  level,
  crewSize,
}: {
  name: string;
  description: string;
  effects: { attribute: string; value: number }[];
  crewLevel: number;
  camouflage: boolean;
  level: number;
  crewSize: number;
}) {
  const lines = effects
    .map((e) => {
      const field = crewSkillField(e.attribute);
      if (!field) return null;
      // Repairs is crew-averaged: show this member's share of the time cut
      // (like Camouflage below), not the whole-crew +80% speed figure.
      const pct =
        e.attribute === "vehicleRepairSpeed"
          ? repairPercent(level, crewSize)
          : effectPercent(field, e.value, level);
      return { label: FIELD_LABEL[field] ?? field, pct };
    })
    .filter((l): l is { label: string; pct: number } => l !== null);
  if (camouflage) {
    const pct = camoPercent(level, crewSize);
    lines.push(
      { label: "Camo (still)", pct },
      { label: "Camo (moving)", pct },
    );
  }
  const crewAveraged =
    camouflage || effects.some((e) => e.attribute === "vehicleRepairSpeed");
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">{name}</div>
      {description ? (
        <div className="text-background/60">{description}</div>
      ) : null}
      {lines.length > 0 ? (
        <div className="space-y-0.5 border-t border-background/20 pt-1.5">
          {lines.map((l) => (
            <div
              key={l.label}
              className="flex justify-between gap-3 tabular-nums"
            >
              <span className="text-background/60">{l.label}</span>
              <span>{`${l.pct > 0 ? "+" : ""}${l.pct}%`}</span>
            </div>
          ))}
          {crewAveraged ? (
            <div className="pt-1 text-[11px] text-background/50">
              This member&apos;s share; each crew member adds the same again.
            </div>
          ) : null}
        </div>
      ) : crewLevel > 0 ? (
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          Raises the whole crew&apos;s effective level, improving every
          crew-affected stat (view range, reload, aiming, traverse, ...). Best
          when the entire crew has it.
        </div>
      ) : (
        // No mapped characteristic: the skill acts on something the table does
        // not list (Fire Fighting shortens fires, others resist stun, save the
        // crew, ...), so training it here leaves the values unchanged.
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          Situational effect not shown in the characteristics above (e.g. fire
          duration, stun resistance, crew survival).
        </div>
      )}
    </div>
  );
}

type CrewSkillItem = TankCrewData["skills"][number];

/** The skill's display name, falling back to a humanized key when WG's
 * `crewskills` returns no localized name (it does this for `fireFighting`), so
 * the tile and its tooltip are never blank. `fireFighting` -> "Fire Fighting". */
function skillName(skill: CrewSkillItem): string {
  if (skill.name) return skill.name;
  const base = skill.key.includes("_")
    ? skill.key.slice(skill.key.indexOf("_") + 1)
    : skill.key;
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** One selectable skill tile (icon, selected check, has-effect dot) with its
 * effect-breakdown tooltip. Extracted so each member can lay its skills out in
 * several rows (universal skills, then one row per role) without duplicating it. */
function SkillButton({
  skill,
  memberIndex,
  selected,
  onToggle,
  level,
  crewSize,
  atCap,
}: {
  skill: CrewSkillItem;
  memberIndex: number;
  selected: Set<string>;
  onToggle: (memberIndex: number, skillKey: string) => void;
  level: number;
  crewSize: number;
  /** The member already has its max trained skills; unselected tiles dim and
   * stop toggling (the hook enforces the cap too). */
  atCap: boolean;
}) {
  const id = `${memberIndex}:${skill.key}`;
  const isOn = selected.has(id);
  const name = skillName(skill);
  const blocked = atCap && !isOn;
  const hasEffect =
    skill.effects.length > 0 || skill.crewLevel > 0 || skill.camouflage;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => !blocked && onToggle(memberIndex, skill.key)}
          aria-pressed={isOn}
          aria-disabled={blocked}
          aria-label={name}
          className={blocked ? "cursor-not-allowed" : "cursor-pointer"}
        >
          <span
            className={cn(
              "relative flex size-11 items-center justify-center rounded-lg border-2 transition-colors",
              isOn
                ? "border-[#f25322]/60 bg-[#f25322]/10"
                : "border-fd-border hover:bg-fd-secondary/30",
              blocked && "opacity-40 hover:bg-transparent",
            )}
          >
            {skill.image ? (
              <Image
                src={skill.image}
                alt=""
                width={28}
                height={28}
                className={cn("object-contain", !isOn && "opacity-80")}
                style={{ width: 28, height: 28 }}
              />
            ) : null}
            {isOn ? (
              <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[#f25322] ring-2 ring-fd-background">
                <CheckIcon className="size-2.5 text-white" strokeWidth={3} />
              </span>
            ) : null}
            {hasEffect ? (
              <span className="absolute -top-1 -left-1 size-1.5 rounded-full bg-[#f25322]/70" />
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-none">
        <SkillTooltip
          name={name}
          description={skill.description}
          effects={skill.effects}
          crewLevel={skill.crewLevel}
          camouflage={skill.camouflage}
          level={level}
          crewSize={crewSize}
        />
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The tank's crew and its skills. One block per crew member: its role(s), then
 * its skills laid out in rows — the universal skills (Repairs / Camouflage /
 * Brothers in Arms) first, then one row per role the member fills. A global
 * training-level slider scales the selected skills' effects. The parent applies
 * the selected skills to the characteristics.
 */
export function TankCrew({
  crew,
  selected,
  onToggle,
  level,
  onLevel,
  screenLines = true,
  headerBorder = false,
}: {
  crew: TankCrewData;
  /** Selected skills, keyed `"<memberIndex>:<skillKey>"`. */
  selected: Set<string>;
  onToggle: (memberIndex: number, skillKey: string) => void;
  /** Crew training level as a 0–1 fraction. */
  level: number;
  onLevel: (level: number) => void;
  screenLines?: boolean;
  headerBorder?: boolean;
}) {
  if (crew.members.length === 0 || crew.skills.length === 0) return null;
  const byKey = new Map(crew.skills.map((s) => [s.key, s]));
  const pct = Math.round(level * 100);
  return (
    <TooltipProvider delayDuration={100}>
      <Panel screenLines={screenLines}>
        <PanelHeader
          screenLines={screenLines}
          className={cn(
            "flex items-center justify-between gap-4",
            headerBorder && "border-b border-fd-border",
          )}
        >
          <PanelTitle>Crew Skills</PanelTitle>
          <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
            <span className="whitespace-nowrap">Crew level</span>
            <Slider
              // In game the major qualification never drops below 50%
              // (a fresh crew starts there), so the simulator matches.
              min={MIN_ROLE_LEVEL}
              max={100}
              value={[pct]}
              onValueChange={([v]) => onLevel(v / 100)}
              aria-label="Crew training level"
              className="w-28 [&_[data-slot=slider-range]]:bg-[#f25322] [&_[data-slot=slider-thumb]]:border-[#f25322]"
            />
            <span className="w-9 text-right tabular-nums text-fd-foreground">
              {pct}%
            </span>
          </div>
        </PanelHeader>
        <PanelContent className="space-y-5 px-4 py-6">
          {crew.members.map((m, mi) => {
            // Lay this member's skills out in rows: the universal skills
            // (role `common`: Repairs / Camouflage / Brothers in Arms) first,
            // then one row per role the member fills (a Commander + Radio
            // Operator gets a commander row and a radio row). A trailing
            // catch-all row guarantees no skill is dropped.
            const placed = new Set<string>();
            const rowFor = (roleKey: string) => {
              const keys = m.skills.filter(
                (k) => !placed.has(k) && byKey.get(k)?.role === roleKey,
              );
              keys.forEach((k) => placed.add(k));
              return keys;
            };
            const rows: { key: string; skills: string[] }[] = [];
            const common = rowFor("common");
            if (common.length) rows.push({ key: "common", skills: common });
            for (const role of m.roles) {
              const keys = rowFor(role);
              if (keys.length) rows.push({ key: role, skills: keys });
            }
            const leftover = m.skills.filter((k) => !placed.has(k));
            if (leftover.length) rows.push({ key: "other", skills: leftover });
            // In-game cap: a member trains at most MAX_MAJOR_PERKS skills.
            let selectedCount = 0;
            for (const id of selected)
              if (Number(id.slice(0, id.indexOf(":"))) === mi)
                selectedCount += 1;
            const atCap = selectedCount >= MAX_MAJOR_PERKS;
            return (
              <div key={m.memberId} className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-medium text-fd-muted-foreground">
                  <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-md border border-fd-border bg-fd-secondary/40">
                    {m.image ? (
                      <Image
                        src={m.image}
                        alt=""
                        width={44}
                        height={44}
                        className="size-full object-cover"
                        style={{ width: 44, height: 44 }}
                      />
                    ) : null}
                    {m.roleBadge ? (
                      <Image
                        src={m.roleBadge}
                        alt=""
                        width={16}
                        height={16}
                        className="absolute right-0.5 bottom-0.5 size-4 object-contain drop-shadow"
                        style={{ width: 16, height: 16 }}
                      />
                    ) : null}
                  </span>
                  <span>
                    {m.roles.map((r) => ROLE_LABEL[r] ?? r).join(" / ")}
                  </span>
                </div>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div key={row.key} className="flex flex-wrap gap-2">
                      {row.skills.map((key) => {
                        const s = byKey.get(key);
                        if (!s) return null;
                        return (
                          <SkillButton
                            key={key}
                            skill={s}
                            memberIndex={mi}
                            selected={selected}
                            onToggle={onToggle}
                            level={level}
                            crewSize={crew.members.length}
                            atCap={atCap}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
