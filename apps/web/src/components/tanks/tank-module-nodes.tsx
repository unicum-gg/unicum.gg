"use client";

import Image from "next/image";
import Link from "next/link";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import { CurrencyIcon } from "@/components/tanks/currency-icon";
import { TankIcon } from "@/components/players/tank-icon";
import ROUTES from "@/constants/routes";
import type { VehicleMeta } from "@unicum.gg/shared";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function ModuleNode({ module }: { module: TankModuleNode }) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
      <div className="flex h-7 w-full items-center justify-center">
        {module.image ? (
          // WG's per-class Tankopedia glyph (uniform 59x59 on
          // api.worldoftanks.*/static, an allowed remote host), through
          // next/image for format negotiation + caching. Rendered at h-7.
          <Image
            src={module.image}
            alt=""
            width={59}
            height={59}
            className="h-7 w-auto object-contain opacity-80"
          />
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-1 text-center leading-none">
        {module.tier ? (
          <span className="text-[11px] font-bold text-fd-muted-foreground">
            {toRoman(module.tier)}
          </span>
        ) : null}
        <span
          className="max-w-24 truncate text-xs text-fd-foreground/85"
          title={module.name}
        >
          {module.name}
        </span>
        {module.isDefault ? (
          <span className="text-[10px] leading-none text-fd-muted-foreground">
            Stock
          </span>
        ) : (
          <div className="flex items-center gap-2 text-[10px] leading-none text-fd-muted-foreground">
            <span className="flex items-center gap-0.5">
              <CurrencyIcon type="xp" className="size-2.5" />
              {compactFmt.format(module.priceXp)}
            </span>
            <span className="flex items-center gap-0.5">
              <CurrencyIcon type="credits" className="h-2.5 w-auto" />
              {compactFmt.format(module.priceCredit)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// The tank whose modules these are, highlighted like the tech-tree branch's
// current node.
export function CurrentTankNode({
  region,
  meta,
}: {
  region: Region;
  meta: VehicleMeta;
}) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
      <div className="relative flex h-7 w-full items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(242,83,34,0.22),transparent_70%)]" />
        <TankIcon
          region={region}
          tag={meta.tag}
          type={meta.type}
          className="relative h-4 w-auto object-contain"
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center leading-none">
        <span className="text-[11px] font-bold text-[#f25322]">
          {meta.tier ? toRoman(meta.tier) : String(meta.tier)}
        </span>
        <span
          className="max-w-24 truncate text-xs font-semibold text-[#f25322]"
          title={meta.name}
        >
          {meta.shortName || meta.name}
        </span>
      </div>
    </div>
  );
}

// A vehicle the module tree researches, styled like the tech-tree nodes.
export function NextTankNode({
  region,
  item,
}: {
  region: Region;
  item: ResearchPathItem;
}) {
  const { meta } = item;
  return (
    <Link href={ROUTES.TANK(region, item.slug)} className="group">
      <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
        <div className="flex h-7 w-full items-center justify-center">
          <TankIcon
            region={region}
            tag={meta.tag}
            type={meta.type}
            className="h-4 w-auto object-contain opacity-80 transition-transform duration-200 group-hover:scale-110 group-hover:opacity-100"
          />
        </div>
        <div className="flex flex-col items-center gap-1 text-center leading-none">
          <span className="text-[11px] font-bold text-fd-muted-foreground">
            {meta.tier ? toRoman(meta.tier) : String(meta.tier)}
          </span>
          <span
            className="max-w-24 truncate text-xs text-fd-foreground/85"
            title={meta.name}
          >
            {meta.shortName || meta.name}
          </span>
          {item.researchXp ? (
            <span className="flex items-center gap-0.5 text-[10px] leading-none text-fd-muted-foreground">
              <CurrencyIcon type="xp" className="size-2.5" />
              {compactFmt.format(item.researchXp)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
