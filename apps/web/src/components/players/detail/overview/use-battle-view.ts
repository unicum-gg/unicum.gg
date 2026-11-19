"use client";

import { useState, useSyncExternalStore } from "react";
import {
  createNumericParamStore,
  sharedParamStore,
} from "@/lib/url-param-store";
import { BattleParam, BattleTab } from "./battle-types";

const tabStore = sharedParamStore(BattleParam.Tab);
const playerStore = createNumericParamStore(BattleParam.Player);

const readTab = (): BattleTab | null => {
  const raw = tabStore.read();
  return Object.values(BattleTab).includes(raw as BattleTab)
    ? (raw as BattleTab)
    : null;
};

/**
 * The view and the player a battle's own page has open, read from the URL.
 *
 * Exported apart from `useBattleView` for the page's share button, which sits
 * above the battle and has to hand over the same view the reader is on.
 */
export function useBattleUrlView(
  initialTab: BattleTab = BattleTab.Teams,
  initialPlayer: number | null = null,
  /** The view a bare URL means: the teams, or a recorder's results screen. */
  defaultTab: BattleTab = BattleTab.Teams,
): { tab: BattleTab; player: number | null } {
  // The server snapshot is what the page read from the same params, so the
  // render the server sends and the first one in the browser agree.
  const tab = useSyncExternalStore(
    tabStore.subscribe,
    readTab,
    () => initialTab,
  );
  const player = useSyncExternalStore(
    playerStore.subscribe,
    playerStore.read,
    () => initialPlayer,
  );
  // An absent `?tab=` is the page's own default view, which is the teams on a
  // battle and the recorder's results screen on their side of it.
  return { tab: tab ?? defaultTab, player };
}

/**
 * Which view of a battle is open, and which player.
 *
 * In the URL on the battle's own page, so a reader can link straight to one
 * player's line in one battle. In state everywhere else: a player's list can
 * hold several battles open at once, and one `?player=` cannot say which of
 * them it means.
 */
export function useBattleView({
  syncUrl,
  initialTab,
  initialPlayer,
  defaultTab = BattleTab.Teams,
}: {
  syncUrl: boolean;
  initialTab: BattleTab;
  initialPlayer: number | null;
  defaultTab?: BattleTab;
}): {
  tab: BattleTab;
  setTab: (tab: BattleTab) => void;
  opened: number | null;
  setOpened: (id: number | null) => void;
} {
  const [localTab, setLocalTab] = useState(initialTab);
  const [localOpened, setLocalOpened] = useState(initialPlayer);
  const url = useBattleUrlView(initialTab, initialPlayer, defaultTab);
  if (!syncUrl) {
    return {
      tab: localTab,
      setTab: setLocalTab,
      opened: localOpened,
      setOpened: setLocalOpened,
    };
  }
  return {
    tab: url.tab,
    // The rosters are the page's default, so they leave the address clean.
    // The page's default view leaves the URL bare, so a shared link stays
    // the canonical address.
    setTab: (tab) => tabStore.write(tab === defaultTab ? null : tab),
    opened: url.player,
    setOpened: playerStore.write,
  };
}
