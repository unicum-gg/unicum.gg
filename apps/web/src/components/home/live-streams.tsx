"use client";

import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  ChatCircleIcon,
  ChatCircleSlashIcon,
  TwitchLogoIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { useTheme } from "next-themes";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_RATING_METRIC, isRatingMetric, RATING_METRIC_LABEL, RatingMetric, type LiveStreamer } from "@unicum.gg/shared";
import { AddChannelCta } from "@/components/home/add-channel-cta";
import { FeaturedPlayer } from "@/components/home/featured-player";
import { usePeriod } from "@/hooks/use-period";
import { PeriodSelect } from "@/components/home/period-select";
import {
  ClanTag,
  METRIC_VALUE,
  StreamRow,
} from "@/components/home/stream-row";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { languageToCountryCode } from "@/lib/language-flags";
import { useLiveStreamers } from "@/hooks/use-live-streamers";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function thumb(url: string, w: number, h: number): string {
  return url.replace("{width}", String(w)).replace("{height}", String(h));
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

  const [period, setPeriod] = usePeriod();

  const sorted = useMemo(() => {
    const value = METRIC_VALUE[period][metric];
    return [...streamers].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1));
  }, [streamers, metric, period]);

  // The featured stream follows the top of the current sort (metric + period)
  // until the visitor explicitly picks one in the table; their pick then
  // sticks across re-sorts, and falls back to the top if that stream ends.
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  // Theater mode (desktop): drop the sidebar below the player so the stream
  // goes full width, YouTube-style. Desktop-only; mobile is always stacked.
  const [theater, setTheater] = useState(false);
  // Twitch chat for the active stream, closed by default (Twitch's own
  // video-with-chat layout cannot start collapsed, so the chat is a separate
  // embed iframe we toggle ourselves).
  const [chatOpen, setChatOpen] = useState(false);
  const { resolvedTheme } = useTheme();
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
  const active =
    (selectedLogin
      ? sorted.find((s) => s.twitchLogin === selectedLogin)
      : undefined) ?? sorted[0];

  // In the normal layout the chat REPLACES the streamers list, so closing it
  // reads as bringing the list back; in theater both are visible side by side.
  const chatLabel = chatOpen
    ? theater
      ? "Hide chat"
      : "Show streamers"
    : "Show chat";
  const chatIcon = chatOpen ? (
    theater ? (
      <ChatCircleSlashIcon className="size-4" />
    ) : (
      <UsersIcon className="size-4" />
    )
  ) : (
    <ChatCircleIcon className="size-4" />
  );

  const streamersTable = (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr]:h-11">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4!">Player</TableHead>
          <TableHead className="w-20 whitespace-nowrap text-right!">
            Viewers
          </TableHead>
          <TableHead className="w-20 pr-4 text-right!">{metricLabel}</TableHead>
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
            onSelect={() => setSelectedLogin(s.twitchLogin)}
          />
        ))}
      </TableBody>
    </Table>
  );
  // The 1px bottom padding keeps the panel's screen line visible: it is
  // painted at z-index -1 on the panel's last pixel row, so an opaque iframe
  // reaching the very edge would cover it (the table shows it through its
  // transparent background).
  const chatFrame = parent ? (
    <div className="h-96 w-full pb-0.5 lg:h-full">
      <iframe
        src={`https://www.twitch.tv/embed/${encodeURIComponent(active.twitchLogin)}/chat?parent=${parent}${resolvedTheme === "dark" ? "&darkpopout" : ""}`}
        title={`${active.nickname} Twitch chat`}
        className="size-full"
      />
    </div>
  ) : null;

  return (
    <>
      <h1 className="sr-only">
        {APP.NAME}: World of Tanks player, clan and tank stats
      </h1>
      <Panel className="flex flex-col">
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            <span className="mr-2 text-[#eb0400]">●</span>
            Top players streaming now ·{" "}
            <PeriodSelect period={period} onChange={setPeriod} />
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
                    <StreamLanguageFlag
                      language={active.language}
                      region={active.region}
                    />
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setChatOpen((o) => !o)}
                        aria-pressed={chatOpen}
                        aria-label={chatLabel}
                        className="shrink-0"
                      >
                        {chatIcon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{chatLabel}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setTheater((t) => !t)}
                        aria-pressed={theater}
                        aria-label={theater ? "Exit theater mode" : "Theater mode"}
                        className="hidden shrink-0 lg:inline-flex"
                      >
                        {theater ? (
                          <ArrowsInSimpleIcon className="size-4" />
                        ) : (
                          <ArrowsOutSimpleIcon className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {theater ? "Exit theater mode" : "Theater mode"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                      >
                        <a
                          href={`https://www.twitch.tv/${active.twitchLogin}`}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          aria-label={`Watch ${active.nickname} on Twitch`}
                        >
                          <TwitchLogoIcon className="size-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Watch {active.nickname} on Twitch
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Sidebar. Normal layout: the live table, swapped for the active
                stream's Twitch chat when toggled (official standalone chat
                embed; switching streams swaps the iframe src). Theater: the
                full-width band below the player fits both, table on the left
                and chat on the right. */}
            <div
              className={cn(
                "border-t border-fd-border",
                !theater && "lg:relative lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l",
              )}
            >
              {theater ? (
                <div className="flex flex-col lg:flex-row">
                  <div className="min-w-0 flex-1">{streamersTable}</div>
                  {chatOpen && chatFrame ? (
                    <div className="border-t border-fd-border lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-l">
                      {chatFrame}
                    </div>
                  ) : null}
                </div>
              ) : chatOpen && chatFrame ? (
                chatFrame
              ) : (
                /* Absolutely positioned (desktop) so a long streamer list can
                   never stretch the panel past the player column: the panel
                   height is the video's, and the list scrolls inside. It also
                   keeps the height identical whether the table or the chat is
                   shown. */
                <div className="lg:absolute lg:inset-0 lg:overflow-y-auto">
                  {streamersTable}
                </div>
              )}
            </div>
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

/** The stream's spoken language (from Twitch) as a small inline flag. */
function StreamLanguageFlag({
  language,
  region,
}: {
  language: string;
  region: Region;
}) {
  // Tolerate payloads predating the field (stale SSE snapshots, old caches).
  const country = language ? languageToCountryCode(language, region) : null;
  if (!country) return null;
  const name = LANGUAGE_NAMES.of(language) ?? language.toUpperCase();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Image
            src={`/flags/s/${country}.svg`}
            alt={`Stream language: ${name}`}
            width={16}
            height={12}
            className="ml-2 inline-block rounded-[2px] align-baseline"
          />
        </TooltipTrigger>
        <TooltipContent side="top">Stream language · {name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
