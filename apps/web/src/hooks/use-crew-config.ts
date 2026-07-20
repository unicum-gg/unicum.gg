"use client";

import { useMemo, useState } from "react";
import { MAX_MAJOR_PERKS, type AppliedCrewSkill } from "@unicum.gg/shared";
import type { TankCrew as TankCrewData } from "@unicum.gg/core/wargaming/wot/tanks/crew";

/** The subset of a shared config URL this hook seeds its state from. */
export interface InitialCrew {
  skills?: string[];
  /** Crew training level as a 0-1 fraction. */
  level?: number;
}

export function useCrewConfig(crew: TankCrewData | null, initial?: InitialCrew) {
  // Crew skills: which skills are selected (keyed "<memberIndex>:<skillKey>") and
  // the training level; both start empty/full so the section is ready to reveal
  // an effect on the first pick. Applied effects are the selected skills that
  // move a displayed characteristic. Seeded from a shared config URL when present,
  // dropping any skill the addressed member can't actually train.
  const crewSkills = useMemo(() => crew?.skills ?? [], [crew]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(() => {
    if (!crew || !initial?.skills) return new Set();
    const out = new Set<string>();
    for (const id of initial.skills) {
      const sep = id.indexOf(":");
      const mi = Number(id.slice(0, sep));
      const key = id.slice(sep + 1);
      if (crew.members[mi]?.skills.includes(key)) out.add(id);
    }
    return out;
  });
  const [crewLevel, setCrewLevel] = useState(
    initial?.level != null ? Math.min(1, Math.max(0.5, initial.level)) : 1,
  );

  // The commander raises every other crew member's effective skill level by 10%
  // of his own level (the game's COMMANDER_ADDITION_RATIO = 10); he gets no self
  // bonus. So a skill trained on a non-commander member runs at 110 points under
  // a fully trained commander, and the crew-averaged common skills count each
  // member as `1.1` except the commander.
  const commanderIdx = useMemo(
    () => crew?.members.findIndex((m) => m.roles.includes("commander")) ?? -1,
    [crew],
  );

  const appliedCrewSkills: AppliedCrewSkill[] = useMemo(() => {
    if (selectedSkills.size === 0) return [];
    const byKey = new Map(crewSkills.map((s) => [s.key, s]));
    const out: AppliedCrewSkill[] = [];
    for (const id of selectedSkills) {
      const sep = id.indexOf(":");
      const mi = Number(id.slice(0, sep));
      const key = id.slice(sep + 1);
      const s = byKey.get(key);
      // Common skills (Repairs, Camouflage, Brothers in Arms) are crew-averaged,
      // not compounded per member: they're applied once via their coverage level
      // (repairLevel / camoLevel / crewLevelIncrease), so they are skipped here.
      if (s && s.role !== "common" && s.effects.length > 0)
        out.push({
          effects: s.effects.map((e) => ({ param: e.attribute, value: e.value })),
          scale: mi === commanderIdx ? 1 : 1.1,
        });
    }
    return out;
  }, [selectedSkills, crewSkills, commanderIdx]);

  // The crew-training-level increase from selected crew-level skills (Brothers
  // in Arms). It scales with how much of the crew has it (per the game formula:
  // sum of members' levels / total crew), so partial coverage is a partial
  // bonus, and with the training-level slider.
  const crewLevelIncrease = useMemo(() => {
    const members = crew?.members.length ?? 0;
    if (!members || selectedSkills.size === 0) return 0;
    const byKey = new Map(crewSkills.map((s) => [s.key, s]));
    let sum = 0;
    for (const id of selectedSkills) {
      const key = id.slice(id.indexOf(":") + 1);
      const s = byKey.get(key);
      if (s && s.crewLevel > 0) sum += s.crewLevel;
    }
    return (crewLevel / members) * sum;
  }, [crew, selectedSkills, crewSkills, crewLevel]);

  // The Repairs skill is common (crew-averaged like Camouflage): its effective
  // level is the crew coverage times the training slider. Applied once (never
  // compounded per member) via applyRepairs, which speeds repair by up to +80%
  // (WG's figure for a fully trained crew).
  const repairSkill = useMemo(
    () =>
      crewSkills.find(
        (s) =>
          s.role === "common" &&
          s.effects.some((e) => e.attribute === "vehicleRepairSpeed"),
      ) ?? null,
    [crewSkills],
  );
  const repairLevel = useMemo(() => {
    const members = crew?.members.length ?? 0;
    if (!members || !repairSkill || selectedSkills.size === 0) return 0;
    // Each trained member contributes its effective level (the commander bonus
    // lifts every non-commander member to 1.1), averaged over the whole crew:
    // a 4-man crew all trained in Repairs → (1 + 1.1×3) / 4 = 1.075.
    let sum = 0;
    for (const id of selectedSkills) {
      const sep = id.indexOf(":");
      if (id.slice(sep + 1) !== repairSkill.key) continue;
      sum += Number(id.slice(0, sep)) === commanderIdx ? 1 : 1.1;
    }
    return (sum * crewLevel) / members;
  }, [crew, selectedSkills, repairSkill, crewLevel, commanderIdx]);

  // The Camouflage skill's effective level: how much of the crew has it, times
  // the training-level slider (0 = no camo skill, our no-skill baseline).
  const camoLevel = useMemo(() => {
    const members = crew?.members.length ?? 0;
    if (!members || selectedSkills.size === 0) return 0;
    const byKey = new Map(crewSkills.map((s) => [s.key, s]));
    // Same per-member averaging as Repairs: the commander bonus lifts every
    // non-commander member's contribution to 1.1.
    let sum = 0;
    for (const id of selectedSkills) {
      const sep = id.indexOf(":");
      if (!byKey.get(id.slice(sep + 1))?.camouflage) continue;
      sum += Number(id.slice(0, sep)) === commanderIdx ? 1 : 1.1;
    }
    return (sum * crewLevel) / members;
  }, [crew, selectedSkills, crewSkills, crewLevel, commanderIdx]);

  // Toggle a skill for a specific crew member (a common skill can be selected
  // independently on each member, so the id carries the member index). A member
  // caps at MAX_MAJOR_PERKS trained skills, as in game.
  function toggleCrewSkill(memberIndex: number, skillKey: string) {
    const id = `${memberIndex}:${skillKey}`;
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      let count = 0;
      for (const cur of next) if (cur.startsWith(`${memberIndex}:`)) count += 1;
      if (count >= MAX_MAJOR_PERKS) return prev;
      next.add(id);
      return next;
    });
  }

  const crewDirty = selectedSkills.size > 0 || crewLevel !== 1;
  function resetCrew() {
    setSelectedSkills(new Set());
    setCrewLevel(1);
  }

  return {
    crewSkills,
    selectedSkills,
    crewLevel,
    setCrewLevel,
    appliedCrewSkills,
    crewLevelIncrease,
    repairSkill,
    repairLevel,
    camoLevel,
    toggleCrewSkill,
    crewDirty,
    resetCrew,
  };
}
