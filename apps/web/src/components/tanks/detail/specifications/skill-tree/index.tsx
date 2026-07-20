"use client";

import { useMemo } from "react";
import Image from "next/image";
import type {
  SkillNode,
  TankSkillTree,
} from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  effectLabel,
  fmtEffect,
} from "@/components/tanks/detail/specifications/field-mods";
import { CATEGORY } from "@/components/tanks/detail/specifications/equipment/category";
import { ResetButton } from "@/components/tanks/detail/specifications/reset-button";

// A node's accent colour: firepower/mobility/survivability reuse the Equipment
// section's category tints (same category, same colour across the page); the
// skill-tree-only `mechanics` category and any unknown fall back here.
const MECHANICS_COLOR = "#c98bdb";
function categoryColor(category: string): string {
  return (
    CATEGORY[category]?.color ??
    (category === "mechanics" ? MECHANICS_COLOR : "#f25322")
  );
}

// Node radius by importance tier.
const NODE_SIZE: Record<string, number> = {
  common: 34,
  major: 42,
  final: 48,
  special: 38,
};

function NodeTooltip({ node }: { node: SkillNode }) {
  return (
    <div className="w-52 space-y-2 text-xs">
      <div>
        {/* The node's own name from the game (`veh_skill_tree.po`). */}
        <div className="font-medium">{node.name}</div>
        {node.description ? (
          <div className="text-background/60">{node.description}</div>
        ) : null}
      </div>
      {node.effects.length > 0 ? (
        <div className="space-y-0.5 border-t border-background/20 pt-1.5">
          {node.effects.map((e, i) => (
            <div key={i} className="flex justify-between gap-3 tabular-nums">
              <span className="text-background/60">
                {effectLabel(e.attribute)}
              </span>
              <span>{fmtEffect(e.type, e.value, e.attribute)}</span>
            </div>
          ))}
        </div>
      ) : node.description ? null : (
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          {node.isFeature
            ? "In-battle loadout switch. No characteristic effect."
            : "Vehicle mechanic. No characteristic effect."}
        </div>
      )}
    </div>
  );
}

/**
 * The tank's vehicle skill tree (the tier-XI "upgrades"): the node graph drawn
 * on a 2D canvas from the client's own layout coordinates, with the unlock edges
 * as connectors. Clicking a reachable node unlocks it (applying its effects);
 * re-locking one cascades to any node that then loses its prerequisites.
 */
export function TankSkillTree({
  skillTree,
  tankName,
  unlocked,
  isAvailable,
  onToggle,
  dirty = false,
  onReset,
}: {
  skillTree: TankSkillTree;
  tankName: string;
  unlocked: Set<number>;
  isAvailable: (id: number) => boolean;
  onToggle: (id: number) => void;
  /** Whether any node is unlocked (shows the reset button). */
  dirty?: boolean;
  /** Reset the section to its default (every node re-locked). */
  onReset?: () => void;
}) {
  const { nodes } = skillTree;
  const byId = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  // Normalise the client coordinates to a padded [0,1] box; the container keeps
  // the graph's aspect ratio so the layout matches the game.
  const bounds = useMemo(() => {
    const xs = nodes.map((n) => n.position[0]);
    const ys = nodes.map((n) => n.position[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, w: maxX - minX || 1, h: maxY - minY || 1 };
  }, [nodes]);

  const PAD = 6; // percent padding so nodes near the edge aren't clipped
  const px = (x: number) => PAD + ((x - bounds.minX) / bounds.w) * (100 - 2 * PAD);
  const py = (y: number) => PAD + ((y - bounds.minY) / bounds.h) * (100 - 2 * PAD);
  // Height relative to width, from the coordinate aspect ratio (kept readable).
  const aspect = Math.min(0.7, Math.max(0.32, bounds.h / bounds.w));

  const edges = useMemo(() => {
    const out: { from: SkillNode; to: SkillNode; live: boolean }[] = [];
    for (const n of nodes) {
      for (const childId of n.unlocks) {
        const to = byId.get(childId);
        if (!to) continue;
        // A connector is "live" (accent) when both ends are unlocked.
        out.push({ from: n, to, live: unlocked.has(n.id) && unlocked.has(to.id) });
      }
    }
    return out;
  }, [nodes, byId, unlocked]);

  return (
    <TooltipProvider delayDuration={100}>
      <Panel>
        <PanelHeader className="flex items-center justify-between gap-4">
          <PanelTitle>{tankName} upgrades</PanelTitle>
          {dirty && onReset ? <ResetButton onReset={onReset} /> : null}
        </PanelHeader>
        <PanelContent className="px-4 py-6">
          <div
            className="relative w-full"
            style={{ paddingBottom: `${aspect * 100}%` }}
          >
            <svg
              aria-hidden
              className="absolute inset-0 size-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {edges.map((e, i) => (
                <line
                  key={i}
                  x1={px(e.from.position[0])}
                  y1={py(e.from.position[1])}
                  x2={px(e.to.position[0])}
                  y2={py(e.to.position[1])}
                  stroke={e.live ? "#f25322" : "currentColor"}
                  strokeWidth={e.live ? 0.5 : 0.35}
                  className={e.live ? undefined : "text-fd-border"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {nodes.map((node) => {
              const isOn = unlocked.has(node.id);
              const available = isAvailable(node.id);
              const size = NODE_SIZE[node.type] ?? 34;
              const color = categoryColor(node.category);
              const blocked = !isOn && !available;
              return (
                <Tooltip key={node.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => (isOn || available) && onToggle(node.id)}
                      aria-pressed={isOn}
                      aria-disabled={blocked}
                      aria-label={node.name}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2",
                        blocked ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                      style={{
                        left: `${px(node.position[0])}%`,
                        top: `${py(node.position[1])}%`,
                        width: size,
                        height: size,
                      }}
                    >
                      <span
                        className={cn(
                          "flex size-full items-center justify-center overflow-hidden border-2 bg-fd-background transition-colors",
                          node.type === "final" ? "rounded-lg" : "rounded-full",
                          blocked && "opacity-40",
                        )}
                        style={{
                          borderColor: isOn ? color : undefined,
                          backgroundColor: isOn ? `${color}22` : undefined,
                        }}
                      >
                        {node.image ? (
                          <Image
                            src={node.image}
                            alt=""
                            width={size}
                            height={size}
                            className={cn(
                              "object-contain",
                              !isOn && "opacity-80 grayscale",
                            )}
                            style={{ width: size * 0.72, height: size * 0.72 }}
                          />
                        ) : (
                          <span
                            className={cn(
                              "block rounded-full",
                              !isOn && "border border-fd-border",
                            )}
                            style={{
                              width: size * 0.4,
                              height: size * 0.4,
                              backgroundColor: isOn ? color : undefined,
                            }}
                          />
                        )}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-none">
                    <NodeTooltip node={node} />
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-fd-muted-foreground">
            Click a reachable node to unlock it; each applies its effect to the
            characteristics above. Colours group nodes by firepower, mobility,
            survivability and vehicle mechanics.
          </p>
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
