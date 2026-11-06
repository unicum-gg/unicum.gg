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
  return { tab: tab ?? BattleTab.Teams, player };
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
}: {
  syncUrl: boolean;
  initialTab: BattleTab;
  initialPlayer: number | null;
}): {
  tab: BattleTab;
  setTab: (tab: BattleTab) => void;
  opened: number | null;
  setOpened: (id: number | null) => void;
} {
  const [localTab, setLocalTab] = useState(initialTab);
  const [localOpened, setLocalOpened] = useState(initialPlayer);
  const url = useBattleUrlView(initialTab, initialPlayer);
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
    setTab: (tab) => tabStore.write(tab === BattleTab.Teams ? null : tab),
    opened: url.player,
    setOpened: playerStore.write,
  };
}
