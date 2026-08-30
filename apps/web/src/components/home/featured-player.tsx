"use client";

import { useCallback, useEffect, useId, useRef } from "react";

type TwitchPlayerInstance = {
  setChannel: (channel: string) => void;
  addEventListener: (event: string, callback: () => void) => void;
  destroy?: () => void;
};

type TwitchPlayerConstructor = {
  new (
    el: string | HTMLElement,
    options: {
      channel: string;
      parent: string[];
      width: string | number;
      height: string | number;
      muted: boolean;
      autoplay: boolean;
    },
  ): TwitchPlayerInstance;
  /** Fired once the embedded iframe is listening for commands. */
  VIDEO_READY: string;
  /** The player-level counterpart; whichever lands first is enough. */
  READY: string;
};

type TwitchEmbed = { Player: TwitchPlayerConstructor };

declare global {
  interface Window {
    Twitch?: TwitchEmbed;
  }
}

const TWITCH_EMBED_SRC = "https://player.twitch.tv/js/embed/v1.js";
let twitchEmbedPromise: Promise<void> | null = null;

// Load Twitch's player SDK once. Unlike a bare <iframe>, a `Twitch.Player`
// instance lets us change channels with `setChannel` without tearing the player
// down, so the viewer's volume and mute choice carry from one stream to the next
// instead of resetting to muted on every switch.
function loadTwitchEmbed(): Promise<void> {
  if (window.Twitch?.Player) return Promise.resolve();
  if (twitchEmbedPromise) return twitchEmbedPromise;
  twitchEmbedPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TWITCH_EMBED_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Twitch embed failed to load"));
    document.head.appendChild(script);
  });
  return twitchEmbedPromise;
}

// How long to wait for the player to announce itself before commanding it
// anyway. Without this the gate below could become permanent: an embed that
// never announces (channel offline at boot, playback blocked, an ad error)
// would leave the player stuck on its construction channel for the whole
// session, which is worse than the race it exists to fix.
const READY_FALLBACK_MS = 8_000;

/**
 * The featured stream, driven by Twitch's Player SDK instead of a bare iframe so
 * that switching channels reuses a single player instance. Reusing it preserves
 * the viewer's volume and mute across streams; a keyed iframe would remount and
 * reset to muted on every switch.
 *
 * The catch is that the player is commandable only once its iframe is listening.
 * Every command is a `postMessage` into that iframe, and the constructor
 * appends it and returns long before the document inside it has installed its
 * message handler, so a `setChannel` issued in that window is delivered nowhere:
 * no error, no console warning, no failed promise. (Measured, not assumed:
 * constructing a player on one channel and calling `setChannel` immediately
 * leaves `getChannel()` on the original channel indefinitely, while the same
 * call issued after the ready event switches.) That is why the player is
 * reconciled rather than commanded: we track the channel it actually adopted
 * and re-apply the wanted one once it can hear us. Firing and forgetting left
 * the player stuck on whichever channel it was built with, which then showed
 * Twitch's "channel is offline" screen once that streamer went off air, while
 * the rest of the rail had long moved on.
 */
export function FeaturedPlayer({
  channel,
  parent,
}: {
  channel: string;
  parent: string;
}) {
  // Twitch's SDK mounts into a div it finds by id (`getElementById`), so give
  // the container a stable, collision-free one.
  const domId = useId();
  const playerRef = useRef<TwitchPlayerInstance | null>(null);
  // If the active channel changes while the SDK is still loading, create the
  // player on the latest one rather than the value captured at mount. Kept in a
  // ref (synced from an effect, never during render) so it isn't an effect dep.
  const channelRef = useRef(channel);
  // The channel the player actually took, as opposed to the one we asked for.
  const appliedRef = useRef<string | null>(null);
  // Commands issued before this are delivered nowhere, so they must be deferred.
  const readyRef = useRef(false);
  const readyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // Idempotent, so it is safe to call from every path that might unblock it.
  // Deliberately does NOT verify the switch afterwards: `getChannel` reflects a
  // state the iframe posts back asynchronously, so a slow switch still reads as
  // the previous channel and a "it did not take" retry would reload the stream
  // the viewer had just started watching.
  const applyChannel = useCallback((): void => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    const wanted = channelRef.current;
    if (appliedRef.current === wanted) return;
    player.setChannel(wanted);
    appliedRef.current = wanted;
  }, []);

  useEffect(() => {
    let disposed = false;
    void loadTwitchEmbed()
      .then(() => {
        if (disposed || playerRef.current || !window.Twitch?.Player) return;
        if (!document.getElementById(domId)) return;
        const Player = window.Twitch.Player;
        const player = new Player(domId, {
          channel: channelRef.current,
          parent: [parent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });
        playerRef.current = player;
        appliedRef.current = channelRef.current;
        // Reconcile on every ready event, not just the first: a channel switch
        // raises one again, which is the free moment to check we landed where we
        // meant to. The channel wanted by then may differ from the one the
        // player was built with, if the rail refreshed while the iframe booted.
        // Both events are subscribed because either one proves the iframe is
        // listening, and the timer covers the embed that announces neither.
        const onReady = () => {
          readyRef.current = true;
          applyChannel();
        };
        player.addEventListener(Player.VIDEO_READY, onReady);
        player.addEventListener(Player.READY, onReady);
        readyTimerRef.current = window.setTimeout(onReady, READY_FALLBACK_MS);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      readyRef.current = false;
      appliedRef.current = null;
      if (readyTimerRef.current !== null) {
        window.clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [parent, domId, applyChannel]);

  useEffect(() => {
    applyChannel();
  }, [channel, applyChannel]);

  return <div id={domId} className="absolute inset-0 size-full" />;
}
