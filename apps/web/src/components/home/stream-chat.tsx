"use client";

import { useState } from "react";
import { useTheme } from "next-themes";

/**
 * The active stream's Twitch chat, as the official standalone embed.
 *
 * Two things it has to get right, both about not remounting or reloading the
 * iframe, because either one wipes the message history the reader was following.
 *
 * It mounts on first open and stays mounted afterwards, so closing it or
 * switching to theater only hides it. Nothing is loaded for the visitors who
 * never open it.
 *
 * And a hidden iframe still reloads when its `src` changes, invisibly and for
 * nothing, so the URL is frozen while the chat is closed: the featured stream
 * rotates on its own as the rail re-sorts, which would otherwise have a closed
 * chat pull a full Twitch page and a fresh IRC socket on every rotation, for
 * the rest of the session. It catches up with the active channel on reopen.
 */
export function StreamChat({
  login,
  nickname,
  parent,
  open,
}: {
  login: string;
  nickname: string;
  parent: string;
  open: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const url = `https://www.twitch.tv/embed/${encodeURIComponent(login)}/chat?parent=${parent}${resolvedTheme === "dark" ? "&darkpopout" : ""}`;
  // One piece of state covers both rules: `null` until the first open (nothing
  // loaded for a visitor who never asks for it), and it only tracks `url` while
  // open (frozen otherwise). Adjusted during render, which is React's documented
  // way to derive state from props, rather than in an effect that would render
  // the stale URL once before correcting it.
  const [shownUrl, setShownUrl] = useState<string | null>(open ? url : null);
  if (open && shownUrl !== url) setShownUrl(url);

  if (shownUrl === null) return null;
  // The 1px bottom padding keeps the panel's screen line visible: it is painted
  // at z-index -1 on the panel's last pixel row, so an opaque iframe reaching
  // the very edge would cover it (the table shows it through its transparent
  // background).
  return (
    <div className="h-96 w-full pb-0.5 lg:h-full">
      <iframe src={shownUrl} title={`${nickname} Twitch chat`} className="size-full" />
    </div>
  );
}
