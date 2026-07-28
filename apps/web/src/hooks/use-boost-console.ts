"use client";

import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";

export type ReserveOption = {
  type: string;
  bonusType: string;
  name: string;
  icon: string;
  durationSec: number;
  activeUntil: string | null;
  levels: {
    level: number;
    amount: number;
    status: string | null;
    percent: number | null;
  }[];
};

export type WorkflowRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerAccountId: number;
  enabled: boolean;
  timezone: string;
  days: number;
  windowStart: number;
  windowEnd: number;
  minOnline: number;
  reserves: { type: string; level: number }[];
  status: string;
  lastOnlineCount: number | null;
  lastActivatedAt: string | null;
};

export type ActivationEntry = {
  id: string;
  workflowName: string;
  reserveType: string;
  reserveName: string;
  reserveLevel: number;
  percent: number | null;
  onlineCount: number;
  activatedAt: string;
};

export type BoostConsoleData =
  | { canManage: false; reason: string }
  | {
      canManage: true;
      clanId: number;
      role: string;
      viewerAccountId: number;
      onlineNow: number;
      membersCount: number;
      workflows: WorkflowRow[];
      reserves: ReserveOption[];
      activations: ActivationEntry[];
    };

export function boostConsoleKey(region: Region, tag: string): string {
  return `/api/${region}/clans/${encodeURIComponent(tag)}/boosts`;
}

async function fetchConsole(url: string): Promise<BoostConsoleData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/**
 * The officer boost console payload for a clan (workflow + live online +
 * reserves), or `{ canManage: false }`. Shared by the Manage tab (to decide
 * whether to show the tab) and the console itself, keyed by the same URL so
 * both share one request.
 */
export function useBoostConsole(region: Region, tag: string) {
  return useSWR<BoostConsoleData>(boostConsoleKey(region, tag), fetchConsole, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}
