import { createNumericParamStore } from "@/lib/url-param-store";

/**
 * The battle being watched, in the URL.
 *
 * Its own module rather than a corner of the player: the community index links
 * to it, and importing the constant should not drag a video player into that
 * page's bundle. The store itself is shared with the correction dialog's own
 * param, which was a line-for-line copy of this one until it was not: theirs
 * has a fragment to clear, and two copies of one mechanism drift exactly there.
 */
export const BATTLE_PARAM = "battle";

const store = createNumericParamStore(BATTLE_PARAM);

export const subscribeToBattleParam = store.subscribe;
export const readBattleParam = store.read;
export const writeBattleParam = store.write;
