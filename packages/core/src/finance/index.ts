import {
  DISPLAY_CURRENCIES,
  BASE_CURRENCY,
  type ExchangeRates,
  env,
} from "@unicum.gg/shared";
import { getRedisClient } from "../redis";

/**
 * Live EUR exchange rates, from UniRateAPI.
 *
 * Every amount the site holds is in euros (the host invoices us, Stripe
 * collects pledges), and a visitor sees them in their region's currency. That conversion
 * used to run off a rate hardcoded at the project's start, which drifted ~8% and
 * made every figure on /support and /coverage wrong in both directions. So the
 * rate is fetched, and never stored alongside the amounts.
 *
 * Rates move slowly and we render them on cached pages, so one read a day is
 * plenty: an in-process memo answers the hot path, a shared Redis entry keeps
 * the whole cluster on one number (and one upstream call), and a provider that
 * cannot be reached serves the last value we saw rather than a fresh guess.
 *
 * Returns null when there is nothing at all to serve — no key configured, or a
 * cold cache and a failing provider. Callers then show euros, which is a correct
 * amount in the wrong currency instead of the reverse.
 */
const RATES_URL = "https://unirateapi.com/api/rates";
const CACHE_KEY = "fx:rates:eur";
/** Refetch once a day: these are daily-published reference rates. */
const FRESH_MS = 24 * 60 * 60 * 1000;
/** How long a value stays usable as a fallback after it stops being fresh. A
 * week of drift beats showing nothing, and beats hammering a provider that is
 * down. */
const STALE_TTL_SECONDS = 7 * 24 * 60 * 60;

type CachedRates = { rates: Record<string, number>; updatedAtMs: number };

declare global {
  // Memoised across route handlers in one process; `globalThis` because Next
  // can evaluate a module more than once.
  var __exchangeRates: CachedRates | null | undefined;
  var __exchangeRatesInFlight: Promise<CachedRates | null> | undefined;
}

export function areExchangeRatesEnabled(): boolean {
  return Boolean(env.UNIRATE_API_KEY);
}

type UniRateResponse = { base?: string; rates?: Record<string, unknown> };

/** Keep only the currencies we can actually render, as numbers. UniRateAPI
 * answers with several hundred (fiat + crypto); the payload we serve should be
 * the handful the front asks for. */
function pickRates(raw: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = { [BASE_CURRENCY]: 1 };
  for (const currency of DISPLAY_CURRENCIES) {
    const value = raw?.[currency];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[currency] = value;
    }
  }
  return out;
}

async function fetchRates(): Promise<CachedRates | null> {
  const apiKey = env.UNIRATE_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL(RATES_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("from", BASE_CURRENCY);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`UniRateAPI returned ${response.status}`);
    const body = (await response.json()) as UniRateResponse;
    const rates = pickRates(body.rates);
    // The base alone means the provider answered with nothing we can use, which
    // must not overwrite a good cached value.
    if (Object.keys(rates).length < 2) {
      throw new Error("UniRateAPI returned no usable rate");
    }
    return { rates, updatedAtMs: Date.now() };
  } catch (error) {
    console.warn("[finance] exchange rate fetch failed:", error);
    return null;
  }
}

async function readCache(): Promise<CachedRates | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    return typeof parsed?.updatedAtMs === "number" && parsed.rates
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function writeCache(entry: CachedRates): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(CACHE_KEY, JSON.stringify(entry), "EX", STALE_TTL_SECONDS);
  } catch {
    // A cache we cannot write is a cache miss next time, nothing more.
  }
}

function isFresh(entry: CachedRates | null | undefined): entry is CachedRates {
  return Boolean(entry && Date.now() - entry.updatedAtMs < FRESH_MS);
}

async function refresh(): Promise<CachedRates | null> {
  const shared = await readCache();
  // Another instance may have refreshed while this one's memo went stale.
  if (isFresh(shared)) return shared;
  const fetched = await fetchRates();
  if (fetched) {
    await writeCache(fetched);
    return fetched;
  }
  // Provider down: the stale shared value, then whatever this process last saw.
  return shared ?? globalThis.__exchangeRates ?? null;
}

/** Current EUR-based rates, or null when we have nothing to serve. */
export async function getExchangeRates(): Promise<ExchangeRates | null> {
  if (isFresh(globalThis.__exchangeRates)) {
    return toPublic(globalThis.__exchangeRates);
  }
  if (!areExchangeRatesEnabled()) return null;
  // One refresh per process at a time: this sits behind cached pages, but a
  // cold start still fans several requests at it at once.
  globalThis.__exchangeRatesInFlight ??= refresh().finally(() => {
    globalThis.__exchangeRatesInFlight = undefined;
  });
  const entry = await globalThis.__exchangeRatesInFlight;
  globalThis.__exchangeRates = entry ?? null;
  return entry ? toPublic(entry) : null;
}

function toPublic(entry: CachedRates): ExchangeRates {
  return {
    base: BASE_CURRENCY,
    rates: entry.rates,
    updatedAt: new Date(entry.updatedAtMs),
  };
}
