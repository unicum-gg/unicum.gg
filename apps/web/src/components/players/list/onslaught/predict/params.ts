import { createParamStore } from "@/lib/url-param-store";

/**
 * The numbers the rank prediction is asked for, held in the URL.
 *
 * A prediction is the kind of thing a player pastes into a clan channel, and
 * one whose state lives only in React cannot be shared at all: the link would
 * open on an empty form. In the URL the link works by construction, and Back
 * leaves the panel as it found it.
 *
 * Strings rather than numbers, because a field being typed into is legitimately
 * empty or half a number, and a numeric store would drop what it could not
 * parse while the reader was still writing it.
 */
export const PREDICT_BATTLES_PARAM = "battles";
export const PREDICT_POINTS_PARAM = "points";

/**
 * How much they intend to play from here, and the reason it is a param of its
 * own rather than a number this works out.
 *
 * It is prefilled with the pace they have kept so far, which their two figures
 * do give: the battles they have played over the days the season has run. But
 * that is a description of the past, and the one thing a reader knows better
 * than any average is whether they are about to play more or less of it. The
 * whole prediction turns on this, so it is theirs to set.
 */
export const PREDICT_PACE_PARAM = "pace";

/**
 * What a battle is worth to them, when they know better than the board does.
 *
 * Prefilled from their own record and adjustable, because someone who has just
 * changed how they play knows it before any average of their season does.
 * Absent from the URL means "use the measured one", which is why it is a param
 * rather than a value written into the field on first render.
 */
export const PREDICT_RATE_PARAM = "rate";

export const predictBattlesStore = createParamStore(PREDICT_BATTLES_PARAM);
export const predictPointsStore = createParamStore(PREDICT_POINTS_PARAM);
export const predictPaceStore = createParamStore(PREDICT_PACE_PARAM);
export const predictRateStore = createParamStore(PREDICT_RATE_PARAM);
