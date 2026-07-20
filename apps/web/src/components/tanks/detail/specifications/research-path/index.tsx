import Link from "next/link";
import { Fragment } from "react";
import { toRoman } from "roman-numerals";
import { CurrencyIcon } from "@/components/tanks/currency-icon";
import { ResearchRail } from "@/components/tanks/detail/specifications/research-rail";
import { TankIcon } from "@/components/players/tank-icon";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { Region } from "@unicum.gg/wargaming";

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// The tank's tech-tree branch: the single cheapest lineage (tier-1 → this tank)
// as a horizontal rail, then the tanks it unlocks. Several next tanks are
// *parallel* forks, so they stack vertically off the current node.
export function TankResearchPath({
  region,
  lineage,
  next,
  currentId,
  tankName,
}: {
  region: Region;
  lineage: ResearchPathItem[];
  next: ResearchPathItem[];
  currentId: number;
  tankName: string;
}) {
  if (lineage.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{tankName} tech tree branch</PanelTitle>
      </PanelHeader>
      <PanelContent className="py-6">
        <ResearchRail>
          {lineage.map((item, i) => (
            <Fragment key={item.tankId}>
              {i > 0 && <Connector />}
              <PathNode
                item={item}
                region={region}
                current={item.tankId === currentId}
              />
            </Fragment>
          ))}
          {next.length === 1 && (
            <>
              <Connector />
              <PathNode item={next[0]} region={region} current={false} />
            </>
          )}
          {next.length >= 2 && (
            <>
              <Connector />
              <Fork nodes={next} region={region} />
            </>
          )}
        </ResearchRail>
      </PanelContent>
    </Panel>
  );
}

// The horizontal rail segment between two nodes, aligned to the icon centre.
function Connector() {
  return <div className="mt-2.5 h-px min-w-6 flex-1 bg-fd-border" />;
}

// Parallel next tanks: a vertical spine off the current node with one stub per
// tank, so they read as separate branches rather than a chain. Every line sits
// at the icon centre (`mt-2.5`), matching the horizontal rail, so the fork lines
// up with the current tank's icon instead of floating between the branches.
function Fork({
  nodes,
  region,
}: {
  nodes: ResearchPathItem[];
  region: Region;
}) {
  return (
    <div className="flex shrink-0 items-start">
      {/* Incoming line from the current tank, at its icon centre. */}
      <div className="mt-2.5 h-px w-4 min-w-4 shrink-0 bg-fd-border" />
      <div className="flex flex-col gap-3">
        {nodes.map((n, i) => (
          <div key={n.tankId} className="flex items-start">
            {/* Bracket cell: a continuous vertical spine (segment per row, each
                extended by the row gap so there's no break) plus a horizontal
                stub into the node, all at the icon centre. */}
            <div className="relative w-4 shrink-0 self-stretch">
              <div
                className={cn(
                  "absolute left-0 w-px bg-fd-border",
                  i === 0
                    ? "top-2.5 -bottom-3"
                    : i === nodes.length - 1
                      ? "top-0 h-2.5"
                      : "top-0 -bottom-3",
                )}
              />
              <div className="absolute left-0 top-2.5 h-px w-full bg-fd-border" />
            </div>
            <PathNode item={n} region={region} current={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PathNode({
  item,
  region,
  current,
}: {
  item: ResearchPathItem;
  region: Region;
  current: boolean;
}) {
  const { meta } = item;
  const tier = meta.tier ? toRoman(meta.tier) : String(meta.tier);

  const inner = (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
      <div className="relative flex h-5 w-full items-center justify-center">
        {current && (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(242,83,34,0.22),transparent_70%)]" />
        )}
        <TankIcon
          region={region}
          tag={meta.tag}
          type={meta.type}
          className={cn(
            "relative h-4 w-auto object-contain transition-transform duration-200",
            !current && "opacity-80 group-hover:scale-110 group-hover:opacity-100",
          )}
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center leading-none">
        <span
          className={cn(
            "text-[11px] font-bold",
            current ? "text-[#f25322]" : "text-fd-muted-foreground",
          )}
        >
          {tier}
        </span>
        <span
          className={cn(
            "max-w-20 truncate text-xs",
            current ? "font-semibold text-[#f25322]" : "text-fd-foreground/85",
          )}
          title={meta.name}
        >
          {meta.shortName || meta.name}
        </span>
        {item.researchXp || item.buyCredits ? (
          <div className="flex items-center gap-2 text-[10px] leading-none text-fd-muted-foreground">
            {item.researchXp ? (
              <span className="flex items-center gap-0.5">
                <CurrencyIcon type="xp" className="size-2.5" />
                {compactFmt.format(item.researchXp)}
              </span>
            ) : null}
            {item.buyCredits ? (
              <span className="flex items-center gap-0.5">
                <CurrencyIcon type="credits" className="h-2.5 w-auto" />
                {compactFmt.format(item.buyCredits)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (current) return inner;
  return (
    <Link href={ROUTES.TANK(region, item.slug)} className="group">
      {inner}
    </Link>
  );
}
