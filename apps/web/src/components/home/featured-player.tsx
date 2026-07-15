"use client";

import { useEffect, useId, useRef } from "react";

type TwitchPlayerInstance = {
  setChannel: (channel: string) => void;
  destroy?: () => void;
};

type TwitchEmbed = {
  Player: new (
    el: string | HTMLElement,
    options: {
      channel: string;
      parent: string[];
      width: string | number;
      height: string | number;
      muted: boolean;
      autoplay: boolean;
    },
  ) => TwitchPlayerInstance;
};

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

/**
 * The featured stream, driven by Twitch's Player SDK instead of a bare iframe so
 * that switching channels reuses a single player instance. Reusing it preserves
 * the viewer's volume and mute across streams; a keyed iframe would remount and
 * reset to muted on every switch.
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
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  useEffect(() => {
    let disposed = false;
    void loadTwitchEmbed()
      .then(() => {
        if (disposed || playerRef.current || !window.Twitch?.Player) return;
        if (!document.getElementById(domId)) return;
        const player = new window.Twitch.Player(domId, {
          channel: channelRef.current,
          parent: [parent],
          width: "100%",
          height: "100%",
          muted: true,
          autoplay: true,
        });
        playerRef.current = player;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [parent, domId]);

  // Swap channels on the live instance; volume and mute persist because it is
  // the same player.
  useEffect(() => {
    playerRef.current?.setChannel(channel);
  }, [channel]);

  return <div id={domId} className="absolute inset-0 size-full" />;
}
