"use client";

import { useMemo, useState } from "react";
import type { AppliedFieldMod } from "@unicum.gg/shared";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";

/**
 * The vehicle skill-tree ("upgrades") concern: which graph nodes are unlocked,
 * respecting the unlock edges (a node needs its prerequisites — ALL of them, or
 * ANY when `unlockStrategyAny`). Unlocking a node applies its stat effects;
 * re-locking one cascades to any node that then loses its prerequisites.
 */
export function useSkillTree(skillTree: TankSkillTree | null) {
  const [unlocked, setUnlocked] = useState<Set<number>>(() => new Set());

  // node id -> the ids that unlock it (its prerequisites).
  const prereqs = useMemo(() => {
    const map = new Map<number, number[]>();
    if (!skillTree) return map;
    for (const n of skillTree.nodes) {
      for (const child of n.unlocks) {
        map.set(child, [...(map.get(child) ?? []), n.id]);
      }
    }
    return map;
  }, [skillTree]);

  const byId = useMemo(
    () => new Map((skillTree?.nodes ?? []).map((n) => [n.id, n])),
    [skillTree],
  );

  // A node is reachable when it has no prerequisite (the root) or its
  // prerequisites are satisfied given the currently unlocked set.
  const canUnlock = useMemo(() => {
    return (id: number, set: Set<number>): boolean => {
      const pre = prereqs.get(id);
      if (!pre || pre.length === 0) return true;
      const node = byId.get(id);
      return node?.unlockStrategyAny
        ? pre.some((p) => set.has(p))
        : pre.every((p) => set.has(p));
    };
  }, [prereqs, byId]);

  /** True when `id` may be clicked to unlock right now. */
  const isAvailable = (id: number): boolean =>
    !unlocked.has(id) && canUnlock(id, unlocked);

  function toggleNode(id: number) {
    setUnlocked((prev) => {
      if (prev.has(id)) {
        // Re-lock: drop it, then prune anything that lost its prerequisites.
        const next = new Set(prev);
        next.delete(id);
        let changed = true;
        while (changed) {
          changed = false;
          for (const nid of next) {
            if (!canUnlock(nid, next)) {
              next.delete(nid);
              changed = true;
            }
          }
        }
        return next;
      }
      if (!canUnlock(id, prev)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const appliedSkillTree: AppliedFieldMod[] = useMemo(() => {
    if (!skillTree) return [];
    const out: AppliedFieldMod[] = [];
    for (const n of skillTree.nodes)
      if (unlocked.has(n.id)) out.push(...n.effects);
    return out;
  }, [skillTree, unlocked]);

  return { unlocked, isAvailable, toggleNode, appliedSkillTree };
}
