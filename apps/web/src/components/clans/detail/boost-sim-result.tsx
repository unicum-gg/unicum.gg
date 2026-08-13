"use client";

import Image from "next/image";
import { UsersIcon } from "@phosphor-icons/react";
import { reserveIconUrl } from "@unicum.gg/shared";

export type SimDecision =
  | "would_activate"
  | "already_active"
  | "no_stock"
  | "unavailable";

export type SimResult = {
  onlineNow: number;
  membersCount: number;
  inWindow: boolean;
  minOnline: number;
  thresholdMet: boolean;
  wouldFire: boolean;
  reserves: {
    type: string;
    name: string;
    decision: SimDecision;
    level: number | null;
    percent: number | null;
  }[];
};

const SIM_LABEL: Record<SimDecision, string> = {
  would_activate: "would activate",
  already_active: "already running",
  no_stock: "no stock ready",
  unavailable: "not available",
};

/** The dry-run "Test run" outcome panel: threshold/window state + per-reserve. */
export function BoostSimResult({ sim }: { sim: SimResult }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fd-border bg-fd-secondary/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <UsersIcon className="size-4 text-fd-muted-foreground" />
          <span className="font-medium tabular-nums text-fd-foreground">
            {sim.onlineNow}
          </span>
          <span className="text-fd-muted-foreground">
            / {sim.membersCount} online
          </span>
        </span>
        <span
          className={
            sim.thresholdMet ? "text-success" : "text-fd-muted-foreground"
          }
        >
          {sim.thresholdMet ? "✓" : "✗"} threshold ({sim.onlineNow}/
          {sim.minOnline})
        </span>
        <span
          className={
            sim.inWindow ? "text-success" : "text-fd-muted-foreground"
          }
        >
          {sim.inWindow ? "✓" : "✗"} in window
        </span>
      </div>
      <div className="font-medium text-fd-foreground">
        {sim.wouldFire
          ? "Right now, it would activate:"
          : "Right now, it would not fire."}
      </div>
      <ul className="flex flex-col gap-0.5 text-fd-muted-foreground">
        {sim.reserves.map((r) => (
          <li key={r.type} className="flex items-center gap-2">
            <Image
              src={reserveIconUrl(r.type)}
              alt=""
              width={20}
              height={20}
              className="size-5 shrink-0"
            />
            <span className="text-fd-foreground">{r.name}</span>
            <span>
              {SIM_LABEL[r.decision]}
              {r.decision === "would_activate" &&
                ` L${r.level}${r.percent != null ? ` (+${r.percent}%)` : ""}`}
            </span>
          </li>
        ))}
        {sim.reserves.length === 0 && <li>No reserves selected.</li>}
      </ul>
    </div>
  );
}
