"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ModuleType, type Region } from "@unicum.gg/wargaming";
import {
  CurrentTankNode,
  ModuleNode,
  NextTankNode,
} from "@/components/tanks/tank-module-nodes";
import { ResearchRail } from "@/components/tanks/research-rail";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import type { VehicleMeta } from "@unicum.gg/shared";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";

// Row order of the in-game Modules screen.
const TYPE_ORDER: ModuleType[] = [
  ModuleType.Gun,
  ModuleType.Turret,
  ModuleType.Engine,
  ModuleType.Chassis,
  ModuleType.Radio,
];

// Vertical anchor of the connector lines inside a node: the icon centre. Tank
// nodes use the same icon-container height as modules so the lines stay flat.
const ANCHOR_Y = 14; // h-7 icon row

/**
 * Research depth of every module: stock is column 0, everything else sits one
 * column right of its deepest prerequisite (unlock edges cross classes, e.g. a
 * gun unlocking a turret, so this follows the actual `nextModules` DAG).
 */
function computeDepths(nodes: TankModuleNode[]): Map<number, number> {
  const ids = new Set(nodes.map((n) => n.moduleId));
  const parents = new Map<number, number[]>();
  for (const node of nodes) {
    for (const child of node.nextModules) {
      if (!ids.has(child)) continue;
      parents.set(child, [...(parents.get(child) ?? []), node.moduleId]);
    }
  }
  const byId = new Map(nodes.map((n) => [n.moduleId, n]));
  const memo = new Map<number, number>();
  const depthOf = (id: number, visiting: Set<number>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let depth: number;
    if (byId.get(id)?.isDefault) {
      depth = 0;
    } else {
      const from = parents.get(id);
      depth = from?.length
        ? 1 + Math.max(...from.map((p) => depthOf(p, visiting)))
        : 1;
    }
    memo.set(id, depth);
    return depth;
  };
  for (const node of nodes) depthOf(node.moduleId, new Set());
  return memo;
}

/**
 * The tank's module research tree, laid out like the in-game Modules screen:
 * one row per module class, stock modules in the first column, upgrades
 * rightward along their unlock edges (drawn as connectors, cross-class ones
 * included), and the vehicles the tree researches at the far right.
 */
export function TankModules({
  region,
  meta,
  nodes,
  nextTanks,
}: {
  region: Region;
  meta: VehicleMeta;
  nodes: TankModuleNode[];
  nextTanks: ResearchPathItem[];
}) {
  if (nodes.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{meta.name} modules</PanelTitle>
      </PanelHeader>
      <PanelContent className="py-6">
        <ResearchRail>
          <ModuleTree
            region={region}
            meta={meta}
            nodes={nodes}
            nextTanks={nextTanks}
          />
        </ResearchRail>
      </PanelContent>
    </Panel>
  );
}

function ModuleTree({
  region,
  meta,
  nodes,
  nextTanks,
}: {
  region: Region;
  meta: VehicleMeta;
  nodes: TankModuleNode[];
  nextTanks: ResearchPathItem[];
}) {
  const depths = useMemo(() => computeDepths(nodes), [nodes]);
  const rows = TYPE_ORDER.filter((t) => nodes.some((n) => n.type === t));
  const moduleCols = 1 + Math.max(...[...depths.values()], 0);
  const tankCol = nextTanks.length > 0 ? moduleCols : null;
  // A "flat" tree (reward tanks: every module stock, nothing to research and no
  // next tank) is just the current tank + one module column, which the
  // full-width grid would otherwise leave floating with a big empty right side.
  // Push that lone module column to the right edge so it reads tank -> modules.
  const isFlat = tankCol === null && moduleCols === 1;

  // Group the nodes per grid cell (same class + same depth stack vertically).
  const cells = new Map<string, TankModuleNode[]>();
  for (const node of nodes) {
    const key = `${rows.indexOf(node.type)}:${depths.get(node.moduleId) ?? 0}`;
    cells.set(key, [...(cells.get(key) ?? []), node]);
  }

  const contentRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<string>("");

  const registerNode = useCallback((key: string) => {
    return (el: HTMLDivElement | null) => {
      if (el) nodeEls.current.set(key, el);
      else nodeEls.current.delete(key);
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const update = () => {
      const base = content.getBoundingClientRect();
      const anchor = (key: string) => {
        const el = nodeEls.current.get(key);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left - base.left,
          right: r.right - base.left,
          y: r.top - base.top + ANCHOR_Y,
        };
      };

      const segments: string[] = [];
      const edge = (fromKey: string, toKey: string) => {
        const a = anchor(fromKey);
        const b = anchor(toKey);
        if (!a || !b) return;
        const sx = a.right + 2;
        const tx = b.left - 2;
        const mx = (sx + tx) / 2;
        segments.push(`M${sx} ${a.y} L${mx} ${a.y} L${mx} ${b.y} L${tx} ${b.y}`);
      };

      const ids = new Set(nodes.map((n) => n.moduleId));
      const tankIds = new Set(nextTanks.map((t) => t.tankId));
      const attached = new Set<number>();
      for (const node of nodes) {
        for (const child of node.nextModules) {
          if (ids.has(child)) edge(`m${node.moduleId}`, `m${child}`);
        }
        for (const tank of node.nextTanks) {
          if (!tankIds.has(tank)) continue;
          edge(`m${node.moduleId}`, `t${tank}`);
          attached.add(tank);
        }
      }
      // Vehicles unlocked at the tank level rather than by a specific module
      // (e.g. a fully-stock tier X opening the next branch): hang them off the
      // first row's deepest module so they still read as part of the tree.
      const orphanSource = nodes.reduce((best, n) => {
        const better =
          TYPE_ORDER.indexOf(n.type) < TYPE_ORDER.indexOf(best.type) ||
          (n.type === best.type &&
            (depths.get(n.moduleId) ?? 0) > (depths.get(best.moduleId) ?? 0));
        return better ? n : best;
      }, nodes[0]);
      for (const tank of nextTanks) {
        if (!attached.has(tank.tankId)) {
          edge(`m${orphanSource.moduleId}`, `t${tank.tankId}`);
        }
      }

      // Bracket joining the stock modules (they are all available from the
      // start), mirroring the in-game screen's left spine.
      const stock = nodes
        .filter((n) => n.isDefault)
        .map((n) => anchor(`m${n.moduleId}`))
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => a.y - b.y);
      const current = anchor("c");
      if (stock.length >= 2) {
        const bx = Math.min(...stock.map((a) => a.left)) - 10;
        segments.push(`M${bx} ${stock[0].y} L${bx} ${stock[stock.length - 1].y}`);
        for (const a of stock) segments.push(`M${bx} ${a.y} L${a.left - 2} ${a.y}`);
        if (current) {
          // The current tank centres on the bracket's span, so a straight
          // horizontal line always meets it.
          segments.push(`M${current.right + 2} ${current.y} L${bx} ${current.y}`);
        }
      } else if (stock.length === 1 && current) {
        segments.push(
          `M${current.right + 2} ${current.y} L${stock[0].left - 2} ${stock[0].y}`,
        );
      }

      setPaths(segments.join(" "));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(content);
    return () => ro.disconnect();
  }, [nodes, nextTanks, depths]);

  return (
    <div ref={contentRef} className="relative min-w-0 flex-1 pl-3">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full text-fd-border"
      >
        <path d={paths} fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div
        className="grid gap-x-10 gap-y-6"
        style={{
          // Even columns across the full panel width (like the tech tree
          // branch), with a floor so narrow viewports scroll instead of
          // crushing the nodes.
          gridTemplateColumns: `repeat(${1 + moduleCols + (tankCol !== null ? 1 : 0)}, minmax(6.5rem, 1fr))`,
        }}
      >
        {[...cells.entries()].map(([key, stack]) => {
          const [row, col] = key.split(":").map(Number);
          return (
            <div
              key={key}
              className={`flex flex-col gap-4 ${isFlat ? "items-end" : "items-center"}`}
              style={{ gridRow: row + 1, gridColumn: col + 2 }}
            >
              {stack.map((node) => (
                <div key={node.moduleId} ref={registerNode(`m${node.moduleId}`)}>
                  <ModuleNode module={node} />
                </div>
              ))}
            </div>
          );
        })}
        {/* The tank this tree belongs to, at the far left like the in-game
            screen, vertically centred on the stock bracket. */}
        <div
          className="flex items-center justify-start"
          style={{ gridRow: `1 / ${rows.length + 1}`, gridColumn: 1 }}
        >
          <div ref={registerNode("c")}>
            <CurrentTankNode region={region} meta={meta} />
          </div>
        </div>
        {tankCol !== null && (
          <div
            className="flex flex-col items-end gap-4"
            style={{ gridRow: 1, gridColumn: tankCol + 2 }}
          >
            {nextTanks.map((tank) => (
              <div key={tank.tankId} ref={registerNode(`t${tank.tankId}`)}>
                <NextTankNode region={region} item={tank} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
