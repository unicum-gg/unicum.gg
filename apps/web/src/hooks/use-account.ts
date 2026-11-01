import useSWR, { preload } from "swr";
import type { WgIdentity } from "@unicum.gg/shared";
import { fetcher } from "@/services/swr";

/** The settings dialog's one read, shared by every section of it. */
export const ACCOUNT_KEY = "/api/account/me";

/** What `GET /api/account/me` answers. */
export type AccountState = {
  loggedIn: boolean;
  twitchAvailable: boolean;
  discordAvailable: boolean;
  wargaming: (WgIdentity & { connectedAt: string }) | null;
  twitch: { login: string | null; connectedAt: string } | null;
  discord: {
    username: string | null;
    globalName: string | null;
    connectedAt: string;
  } | null;
  supporter: boolean;
  loadoutsHidden: boolean;
  battlesHidden: boolean;
};

/**
 * The signed-in account's own state, from one SWR entry.
 *
 * One entry rather than a fetch per section, so moving between the dialog's
 * sections, or closing and reopening it, shows what is already known at once
 * and refreshes it behind the reader instead of starting from a spinner.
 */
export function useAccount() {
  return useSWR<AccountState>(ACCOUNT_KEY);
}

/**
 * Start reading the account before anybody asks for it, so the dialog opens
 * already filled. Deduplicated by SWR, so every place that can open the dialog
 * may call it.
 */
export function preloadAccount(): void {
  void preload(ACCOUNT_KEY, fetcher);
}
