"use client";

type Message<T> = { type: "value"; value: T } | { type: "ask" };

/** A source of pushed values that every tab reads and only one tab holds. */
export type SharedStream<T> = {
  /** React's `useSyncExternalStore` contract. */
  subscribe(onChange: () => void): () => void;
  get(): T | null;
};

/**
 * One server-sent stream per browser instead of one per tab.
 *
 * The site pushes two things that are the same for everybody, the online
 * counter and the live streamers, and both were opened once per tab. Over
 * HTTP/1.1 a browser allows six connections per origin **across all tabs**, and
 * a held EventSource never gives its one back: with the player page's own live
 * sync on top, two open tabs reach the cap and every later request, document
 * and image alike, queues forever. Production multiplexes over HTTP/2 and hides
 * it; local development does not, which is where it bites.
 *
 * So one tab holds the connection and hands the payloads to the others. The
 * leader is elected with a Web Lock, which is the one primitive that both
 * survives a tab crash (the browser releases the lock) and needs no heartbeat:
 * whoever is waiting on `request` simply becomes the next leader. Payloads
 * travel on a `BroadcastChannel`, and a tab opened later asks for the current
 * value rather than waiting for the next push.
 *
 * Degrades to today's behaviour: without Web Locks the tab opens its own
 * stream, so the worst case is what we already had.
 */
export function createSharedStream<T>(
  /** Names the lock and the channel. One per distinct stream (region included). */
  name: string,
  /** Opens the real stream. Called in the leader tab only. */
  open: (emit: (value: T) => void) => () => void,
): SharedStream<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();

  let channel: BroadcastChannel | null = null;
  let closeSource: (() => void) | null = null;
  let releaseLock: (() => void) | null = null;
  let stopping = false;

  const isLeader = () => closeSource !== null;

  function publish(next: T): void {
    value = next;
    for (const notify of listeners) notify();
  }

  function becomeLeader(): void {
    if (stopping || isLeader()) return;
    closeSource = open((next) => {
      publish(next);
      channel?.postMessage({ type: "value", value: next } satisfies Message<T>);
    });
  }

  function start(): void {
    stopping = false;
    channel = new BroadcastChannel(name);
    channel.onmessage = (event: MessageEvent<Message<T>>) => {
      const message = event.data;
      if (message.type === "value") publish(message.value);
      // Only the leader answers, and only once it has something to answer with.
      else if (isLeader() && value !== null) {
        channel?.postMessage({ type: "value", value } satisfies Message<T>);
      }
    };
    channel.postMessage({ type: "ask" } satisfies Message<T>);

    if (!("locks" in navigator)) {
      becomeLeader();
      return;
    }
    // The callback holds the lock for as long as its promise is pending, so the
    // promise is resolved from `stop()` and not before. A tab that loses the
    // race waits here, doing nothing, until the leader lets go.
    void navigator.locks.request(name, () => {
      return new Promise<void>((release) => {
        if (stopping) {
          release();
          return;
        }
        becomeLeader();
        releaseLock = release;
      });
    });
  }

  function stop(): void {
    stopping = true;
    closeSource?.();
    closeSource = null;
    releaseLock?.();
    releaseLock = null;
    channel?.close();
    channel = null;
    // `value` is kept: a component that remounts reads the last known payload
    // instead of blinking back to nothing while the stream reopens.
  }

  return {
    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) stop();
      };
    },
    get: () => value,
  };
}
