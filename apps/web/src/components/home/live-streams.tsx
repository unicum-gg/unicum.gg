"use client";

import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DEFAULT_RATING_METRIC, isRatingMetric, RATING_METRIC_LABEL, RatingMetric, RATING_COLOR_CLASS, wn7Color, wn8Color, wnxColor, type LiveStreamer } from "@unicum.gg/shared";
import { AddChannelCta } from "@/components/home/add-channel-cta";
import {
  LeaderboardPeriod,
  LeaderboardPeriodSelect,
  useLeaderboardPeriod,
} from "@/components/home/leaderboard-period";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useLiveStreamers } from "@/hooks/use-live-streamers";
import { cn } from "@/lib/utils";

// Rank on either lifetime or 30-day WN*, driven by the header's period toggle
// (shared with the "Top players" / "Top clans" panels). 30-day reflects who is
// playing well right now rather than career averages.
const METRIC_VALUE: Record<
  LeaderboardPeriod,
  Record<RatingMetric, (s: LiveStreamer) => number | null>
> = {
  [LeaderboardPeriod.Overall]: {
    [RatingMetric.Wn7]: (s) => s.wn7,
    [RatingMetric.Wn8]: (s) => s.wn8,
    [RatingMetric.Wnx]: (s) => s.wnx,
  },
  [LeaderboardPeriod.Month]: {
    [RatingMetric.Wn7]: (s) => s.wn730d,
    [RatingMetric.Wn8]: (s) => s.wn830d,
    [RatingMetric.Wnx]: (s) => s.wnx30d,
  },
};

const METRIC_COLOR: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function thumb(url: string, w: number, h: number): string {
  return url.replace("{width}", String(w)).replace("{height}", String(h));
}

type TwitchPlayerInstance = {
  setChannel: (channel: string) => void;
  play: () => void;
  addEventListener: (event: string, callback: () => void) => void;
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

export function LiveStreams({
  initial,
  onHide,
}: {
  initial: LiveStreamer[];
  onHide?: () => void;
}) {
  // Deduped with every 🔴 badge on the page (same SWR key), SSR-seeded so the
  // rail paints without a flash.
  const streamers = useLiveStreamers(initial);

  const [storedMetric] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedMetric)
    ? storedMetric
    : DEFAULT_RATING_METRIC;
  const metricLabel = RATING_METRIC_LABEL[metric];

  const [period, setPeriod] = useLeaderboardPeriod();

  const sorted = useMemo(() => {
    const value = METRIC_VALUE[period][metric];
    return [...streamers].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1));
  }, [streamers, metric, period]);

  const [activeLogin, setActiveLogin] = useState(initial[0]?.twitchLogin ?? "");
  // Theater mode (desktop): drop the sidebar below the player so the stream
  // goes full width, YouTube-style. Desktop-only; mobile is always stacked.
  const [theater, setTheater] = useState(false);
  // Twitch's embed requires the exact host serving the page as `parent`, only
  // known client-side (covers unicum.gg and the 127.0.0.1 loopback in dev).
  // `useSyncExternalStore` reads it without a hydration mismatch: `null` on the
  // server and first client render, then the real hostname.
  const parent = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname,
    () => null,
  );

  if (sorted.length === 0) return null;
  const active = sorted.find((s) => s.twitchLogin === activeLogin) ?? sorted[0];

  return (
    <>
      <h1 className="sr-only">
        {APP.NAME} — World of Tanks player, clan and tank stats
      </h1>
      <Panel className="flex flex-col">
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            <span className="mr-2 text-[#eb0400]">●</span>
            Top players streaming now ·{" "}
            <LeaderboardPeriodSelect period={period} onChange={setPeriod} />
          </PanelTitle>
          <div className="flex items-center gap-1.5">
            <AddChannelCta />
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                aria-label="Hide streamers"
                title="Hide streamers"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </div>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className={cn("flex flex-col", !theater && "lg:flex-row")}>
            {/* Featured player */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="relative aspect-video w-full bg-black">
                {parent ? (
                  <FeaturedPlayer channel={active.twitchLogin} parent={parent} />
                ) : (
                  <Image
                    src={thumb(active.thumbnailUrl, 960, 540)}
                    alt={active.title}
                    fill
                    priority
                    unoptimized
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex items-center gap-3 border-t border-fd-border p-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    title={active.title}
                  >
                    {active.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-fd-muted-foreground">
                    <Link
                      href={ROUTES.PLAYER(active.region, active.nickname)}
                      className="font-medium text-fd-foreground hover:underline"
                    >
                      {active.nickname}
                    </Link>
                    {active.clanTag ? (
                      <>
                        {" "}
                        <ClanTag
                          tag={active.clanTag}
                          color={active.clanColor}
                        />
                      </>
                    ) : null}
                    {" · "}
                    {intFmt.format(active.viewerCount)} viewers
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setTheater((t) => !t)}
                  aria-pressed={theater}
                  aria-label={theater ? "Exit theater mode" : "Theater mode"}
                  title={theater ? "Exit theater mode" : "Theater mode"}
                  className="hidden shrink-0 lg:inline-flex"
                >
                  {theater ? (
                    <ArrowsInSimpleIcon className="size-4" />
                  ) : (
                    <ArrowsOutSimpleIcon className="size-4" />
                  )}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://www.twitch.tv/${active.twitchLogin}`}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                  >
                    Watch on Twitch
                  </a>
                </Button>
              </div>
            </div>

            {/* Sidebar: the live table, ranked by the selected metric. In
                theater mode it sits full-width below the player instead of to
                the right. */}
            <div
              className={cn(
                "border-t border-fd-border",
                !theater && "lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l",
              )}
            >
              <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr]:h-11">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4!">Player</TableHead>
                    <TableHead className="w-20 whitespace-nowrap text-right!">
                      Viewers
                    </TableHead>
                    <TableHead className="w-20 pr-4 text-right!">
                      {metricLabel}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s) => (
                    <StreamRow
                      key={s.twitchLogin}
                      streamer={s}
                      metric={metric}
                      period={period}
                      active={s.twitchLogin === active.twitchLogin}
                      onSelect={() => setActiveLogin(s.twitchLogin)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}

/**
 * The featured stream, driven by Twitch's Player SDK instead of a bare iframe so
 * that switching channels reuses a single player instance. Reusing it preserves
 * the viewer's volume and mute across streams; a keyed iframe would remount and
 * reset to muted on every switch.
 */
function FeaturedPlayer({
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
        // Twitch's embed auto-pauses when the window loses focus, and no embed
        // option disables it (its JS lives in the cross-origin iframe, out of
        // our reach). Resume unless the pause was a deliberate click while the
        // page is focused, so the featured stream keeps playing (and audible)
        // when the visitor switches to another window.
        player.addEventListener("pause", () => {
          if (!document.hasFocus()) player.play();
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

function StreamRow({
  streamer,
  metric,
  period,
  active,
  onSelect,
}: {
  streamer: LiveStreamer;
  metric: RatingMetric;
  period: LeaderboardPeriod;
  active: boolean;
  onSelect: () => void;
}) {
  const value = METRIC_VALUE[period][metric](streamer);
  return (
    <TableRow
      onClick={onSelect}
      aria-pressed={active}
      className={cn("cursor-pointer", active && "bg-fd-border/50")}
    >
      <TableCell className="pl-4!">
        <div className="truncate">
          <span className="font-medium">{streamer.nickname}</span>
          {streamer.clanTag ? (
            <>
              {" "}
              <ClanTag tag={streamer.clanTag} color={streamer.clanColor} />
            </>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-fd-muted-foreground">
        {intFmt.format(streamer.viewerCount)}
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right font-semibold tabular-nums",
          value != null && METRIC_COLOR[metric](value),
        )}
      >
        {value != null ? intFmt.format(value) : "—"}
      </TableCell>
    </TableRow>
  );
}

function ClanTag({ tag, color }: { tag: string; color: string | null }) {
  return (
    <span className="font-mono text-xs">
      <span style={{ color: color ?? undefined }}>[</span>
      {tag}
      <span style={{ color: color ?? undefined }}>]</span>
    </span>
  );
}
