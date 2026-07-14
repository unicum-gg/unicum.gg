"use client";

import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import ROUTES from "@/constants/routes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Region } from "@unicum.gg/wargaming";
import type { ClanStint } from "@unicum.gg/shared";

function prettyRole(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

function pickTextColor(bg: string): string {
  const hex = bg.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#000" : "#fff";
}

function yearTicks(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const range = endYear - startYear;
  const step = range > 14 ? 2 : 1;
  for (let y = Math.ceil(startYear / step) * step; y <= endYear; y += step) {
    const d = new Date(Date.UTC(y, 0, 1));
    if (d >= start && d <= end) out.push(d);
  }
  return out;
}

export function PlayerClansTimeline({
  region,
  accountCreatedAt,
  stints,
  nowMs,
}: {
  region: Region;
  accountCreatedAt: Date;
  stints: ClanStint[];
  nowMs: number;
}) {
  const start = useMemo(() => {
    const oldest = stints.reduce<number>(
      (min, s) => Math.min(min, s.joinedAt.getTime()),
      accountCreatedAt.getTime(),
    );
    return new Date(oldest);
  }, [accountCreatedAt, stints]);

  if (stints.length === 0) return null;

  const startMs = start.getTime();
  const totalMs = nowMs - startMs;
  const pct = (ms: number) =>
    Math.max(0, Math.min(100, ((ms - startMs) / totalMs) * 100));

  const ticks = yearTicks(start, new Date(nowMs));

  return (
    <TooltipProvider delayDuration={100}>
      <div>
        <div className="relative h-14 w-full rounded-md bg-muted/40">
          {stints.map((s) => {
            const stintStartMs = s.joinedAt.getTime();
            const stintEndMs = (s.leftAt ?? new Date(nowMs)).getTime();
            const left = pct(stintStartMs);
            const right = pct(stintEndMs);
            const width = Math.max(0.2, right - left);
            const baseColor = s.clan.color || "#666666";
            const textColor = pickTextColor(baseColor);
            const showLabel = width > 4;
            const showEmblem = width > 8;
            const tag = s.clan.tag;
            const clanHref = ROUTES.CLAN(region, tag);
            return (
              <Tooltip key={`${s.clan.id}-${stintStartMs}`}>
                <TooltipTrigger asChild>
                  <Link
                    href={clanHref}
                    className="absolute top-0 bottom-0 flex items-center justify-center gap-1 overflow-hidden rounded-sm px-1 text-[10px] font-semibold tracking-wide transition-opacity hover:opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: baseColor,
                      color: textColor,
                    }}
                  >
                    {showEmblem && (
                      <Image
                        src={s.clan.emblem}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 shrink-0 rounded-sm"
                      />
                    )}
                    {showLabel && <span className="truncate">{tag}</span>}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2 text-xs">
                    <Image
                      src={s.clan.emblem}
                      alt={`${tag} emblem`}
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded"
                    />
                    <div className="grid gap-0.5">
                      <div className="font-semibold">
                        <span style={{ color: s.clan.color }}>[</span>
                        {tag}
                        <span style={{ color: s.clan.color }}>]</span>{" "}
                        {s.clan.name}
                      </div>
                      <div>{prettyRole(s.role)}</div>
                      <div className="tabular-nums text-muted-foreground">
                        {format(s.joinedAt, "MMM d, yyyy")} —{" "}
                        {s.leftAt ? format(s.leftAt, "MMM d, yyyy") : "current"}
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {ticks.map((t) => (
            <div
              key={t.getTime()}
              className="pointer-events-none absolute top-0 bottom-0 border-l border-border/60"
              style={{ left: `${pct(t.getTime())}%` }}
            />
          ))}
        </div>

        <div className="relative mt-1 h-4 w-full text-[10px] text-muted-foreground">
          <span className="absolute left-0">{format(start, "MMM yyyy")}</span>
          {ticks.map((t) => {
            const p = pct(t.getTime());
            if (p < 6 || p > 94) return null;
            return (
              <span
                key={t.getTime()}
                className="absolute -translate-x-1/2 tabular-nums"
                style={{ left: `${p}%` }}
              >
                {t.getUTCFullYear()}
              </span>
            );
          })}
          <span className="absolute right-0">today</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
