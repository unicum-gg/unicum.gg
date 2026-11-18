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

/**
 * Every account signed in on this browser, active one first, each with its
 * current clan.
 *
 * The list deduplicates by user, so an account appears once however many
 * times it signed in. Read once per active account rather than on every menu
 * open: the list only moves when someone signs in, switches or signs out, and
 * each of those ends in a reload. Keyed by the active user id so a list read under one account is
 * never shown under another. The clans are cheap DB-backed SDK calls (no live
 * Wargaming), one per account, and an account whose clan cannot be read is
 * still listed, just without its tag.
 */
export function useDeviceAccounts(
  active: {
    session: { token: string };
    user: { id: string; email: string; name: string };
  } | null,
) {
  const activeUserId = active?.user.id;
  const [state, setState] = useState<{
    userId: string;
    accounts: DeviceAccount[];
  } | null>(null);

  useEffect(() => {
    if (!activeUserId) return;
    let alive = true;
    (async () => {
      const { data } = await authClient.multiSession.listDeviceSessions();
      const sessions = data ?? [];
      // A session minted before multi-session existed has no entry of its own
      // in the list, so the active account is added from the session itself
      // rather than going missing from its own menu.
      if (active && !sessions.some((s) => s.user.id === active.user.id)) {
        sessions.unshift(active as (typeof sessions)[number]);
      }
      const accounts = await Promise.all(
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
      accounts.sort(
        (a, b) =>
          Number(b.userId === activeUserId) - Number(a.userId === activeUserId),
      );
      if (alive) setState({ userId: activeUserId, accounts });
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // The session object is a new identity on every refetch; the account it
    // names is what decides whether the list must be read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  return state && state.userId === activeUserId ? state.accounts : null;
}
