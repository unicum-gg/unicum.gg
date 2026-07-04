import type Redis from "ioredis";
import type { WgRateLimiter } from "@unicum.gg/wargaming";

/**
 * Atomic token bucket in Redis. Refills by elapsed time (Redis's own clock, so
 * instances don't drift), then *reserves* a token by decrementing — going
 * negative when the bucket is empty. The returned `wait` is how long the caller
 * must sleep before its reserved token is due, which serializes concurrent
 * callers (FIFO-ish) instead of stampeding. Idle buckets expire after 60s.
 */
const ACQUIRE_LUA = `
local key = KEYS[1]
local cap = tonumber(ARGV[1])
local rps = tonumber(ARGV[2])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + tonumber(t[2]) / 1000
local d = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(d[1])
local ts = tonumber(d[2])
if tokens == nil then tokens = cap; ts = now end
local elapsed = (now - ts) / 1000.0
if elapsed > 0 then
  tokens = math.min(cap, tokens + elapsed * rps)
  ts = now
end
tokens = tokens - 1
local wait = 0
if tokens < 0 then wait = math.ceil((-tokens) / rps * 1000) end
redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
redis.call('PEXPIRE', key, 60000)
return wait
`;

type RedisWithAcquire = Redis & {
  wgRateAcquire(key: string, capacity: number, rps: number): Promise<number | string>;
};

const withCommand = new WeakSet<Redis>();

function ensureCommand(redis: Redis): RedisWithAcquire {
  if (!withCommand.has(redis)) {
    redis.defineCommand("wgRateAcquire", { numberOfKeys: 1, lua: ACQUIRE_LUA });
    withCommand.add(redis);
  }
  return redis as RedisWithAcquire;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A {@link WgRateLimiter} whose budget is shared across processes via Redis. */
export class RedisRateLimiter implements WgRateLimiter {
  readonly #redis: RedisWithAcquire;

  constructor(
    redis: Redis,
    private readonly key: string,
    private readonly capacity: number,
    private readonly rps: number,
  ) {
    this.#redis = ensureCommand(redis);
  }

  async acquire(): Promise<void> {
    let wait: number;
    try {
      wait = Number(await this.#redis.wgRateAcquire(this.key, this.capacity, this.rps));
    } catch (err) {
      // Fail open: a Redis blip must not stall every WG call. We lose shared
      // limiting for this request, not availability.
      console.warn("[wg rate-limit] Redis unavailable, proceeding unthrottled:", err);
      return;
    }
    if (wait > 0) await sleep(wait);
  }
}
