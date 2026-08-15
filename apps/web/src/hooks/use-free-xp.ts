"use client";

import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { XP_PER_GOLD } from "@unicum.gg/shared";

/**
 * Shared free-XP pricing prefs, cookie-backed so the tank page and the
 * economics table stay in sync (and persist): the tier you free-XP from and the
 * XP-to-gold rate (25 by default, editable for WG promos like 40 XP = 1 gold).
 * `rateInput` is the raw string for the text field; `rate` is the sanitized
 * number used for math (falls back to the default on empty/invalid input).
 */
export function useFreeXpSettings() {
  const [tierRaw, setTierRaw] = useCookie(STORAGE.COOKIES.FREE_XP_TIER, "1");
  const [rateInput, setRateInput] = useCookie(
    STORAGE.COOKIES.XP_RATE,
    String(XP_PER_GOLD),
  );
  const tier = Math.min(10, Math.max(1, Math.round(Number(tierRaw)) || 1));
  const parsed = Number(rateInput);
  const rate = Number.isFinite(parsed) && parsed > 0 ? parsed : XP_PER_GOLD;
  return {
    tier,
    setTier: (t: number) => setTierRaw(String(t)),
    rate,
    rateInput,
    setRate: setRateInput,
  };
}
