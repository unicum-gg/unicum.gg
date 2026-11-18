"use client";

import { useEffect, useState } from "react";
import type { Region } from "@unicum.gg/wargaming";
import { authClient } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { unicum } from "@/services/sdk";

export type AccountClan = { tag: string; name: string; color: string };

export type DeviceAccount = {
  userId: string;
  sessionToken: string;
  nickname: string;
  region: Region | null;
  clan: AccountClan | null;
};

type ActiveSession = {
  session: { token: string };
  user: { id: string; email: string; name: string };
};

async function readAccounts(active: ActiveSession): Promise<DeviceAccount[]> {
  const sessions: ActiveSession[] = await authClient.multiSession
    .listDeviceSessions()
    .then(({ data }) => data ?? [])
    .catch(() => []);
  // A session minted before multi-session existed has no entry of its own in
  // the list, and a failed read has none at all: either way the active
  // account is added from the session itself rather than going missing from
  // its own menu.
  if (!sessions.some((s) => s.user.id === active.user.id)) {
    sessions.unshift(active);
  }
  return Promise.all(
    sessions.map(async ({ session, user }) => {
      const wg = wgIdentityFromEmail(user.email);
      const clan = wg
        ? await unicum
            .region(wg.region)
            .players(user.name)
            .clan()
            .then((res) => res.clan)
            .catch(() => null)
        : null;
      return {
        userId: user.id,
        sessionToken: session.token,
        nickname: user.name,
        region: wg?.region ?? null,
        clan,
      };
    }),
  );
}

/**
 * Every account signed in on this browser, active one first, each with its
 * current clan, or null until a list holding the active account has landed.
 *
 * Null rather than a partial answer is what lets the top bar draw the
 * nickname and the clan tag together: the name is in the session at once
 * while the tag is two requests away, and drawing the name alone first made
 * the tag pop in beside it a moment later.
 *
 * The list deduplicates by user, so an account appears once however many
 * times it signed in. It is read again whenever the active account changes,
 * and while that read is on its way the previous list is kept, re-ordered: an
 * account switched to from the menu is already in it, clan included, so the
 * top bar changes name and tag in one step instead of blanking. The clans are
 * cheap DB-backed SDK calls (no live Wargaming), one per account, and an
 * account whose clan cannot be read is still listed, just without its tag.
 */
export function useDeviceAccounts(active: ActiveSession | null) {
  const activeUserId = active?.user.id;
  const [accounts, setAccounts] = useState<DeviceAccount[] | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    void readAccounts(active).then((next) => {
      if (alive) setAccounts(next);
    });
    return () => {
      alive = false;
    };
    // The session object is a new identity on every refetch; the account it
    // names is what decides whether the list must be read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  if (!accounts || !accounts.some((a) => a.userId === activeUserId)) {
    return null;
  }
  return [...accounts].sort(
    (a, b) =>
      Number(b.userId === activeUserId) - Number(a.userId === activeUserId),
  );
}
