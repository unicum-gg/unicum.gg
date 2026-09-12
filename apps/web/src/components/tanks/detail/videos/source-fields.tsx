"use client";

import { useTranslation } from "@/hooks/use-translation";
import { useMemo, useState } from "react";
import {
  formatTimestamp,
  parseTimestampInput,
  parseYoutubeUrl,
} from "@unicum.gg/shared";
import { VideoScrubber } from "./scrubber";

/**
 * The video itself: which one, and the second the battle starts.
 *
 * Shared by both forms, because it is the half that has nothing to do with what
 * was played. A tank page asks for a vehicle's battle and a map page for a
 * tactic, but a YouTube link is a YouTube link and getting the second right is
 * the thing the whole feature turns on.
 */
export function useVideoSource(initial?: {
  url: string;
  startSeconds: number;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  // Kept apart from the URL and shown as its own field. A link copied with
  // "start at current time" carries `?t=`, and most links are not: without a
  // field for it, forgetting silently files a three-hour VOD at second 0, which
  // is the one thing this feature exists to avoid.
  const [start, setStart] = useState(
    initial ? formatTimestamp(initial.startSeconds) : "",
  );
  const [touched, setTouched] = useState(Boolean(initial));

  // The same parser the endpoint uses, so a bad link is caught before a round
  // trip. The server still validates: a client is not a gate.
  const ref = useMemo(() => (url.trim() ? parseYoutubeUrl(url) : null), [url]);
  // What the start field shows: whatever was typed, else the link's own `?t=`.
  const value = touched || !ref?.startSeconds ? start : formatTimestamp(ref.startSeconds);
  const seconds = parseTimestampInput(value);
  const invalid = value.trim() !== "" && seconds === null;
  // Not a blocker, a warning: a short video devoted to the subject legitimately
  // starts at the beginning, so this says what will happen rather than refusing.
  const missing = Boolean(ref) && !invalid && !seconds;

  return {
    url,
    setUrl,
    ref,
    value,
    seconds,
    invalid,
    missing,
    setStart: (v: string) => {
      setTouched(true);
      setStart(v);
    },
    /** Back to empty, for a second suggestion: pre-filled with the first, it
     * would be refused as a duplicate. */
    reset: () => {
      setUrl("");
      setStart("");
      setTouched(false);
    },
    /** Whether the video half is answered. The second is exempt on purpose. */
    ok: Boolean(ref) && !invalid,
  };
}

const INPUT =
  "h-9 rounded-md border border-fd-border bg-transparent px-3 text-sm focus:border-fd-ring focus:outline-none";

export function VideoSourceFields({
  source,
  children,
}: {
  source: ReturnType<typeof useVideoSource>;
  /** Rendered beside the start time, for whatever else the form reads off the
   * same after-battle screen. */
  children?: React.ReactNode;
}) {
  const { t: tCopy } = useTranslation("components/tanks/detail/videos/source-fields");
  const { t } = useTranslation("components/tanks/detail/videos/source-fields");
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("youtube-link")}</span>
        <input
          type="url"
          value={source.url}
          onChange={(e) => source.setUrl(e.target.value)}
          placeholder={t("https-www-youtube-com-watch")}
          className={INPUT}
        />
        {source.url.trim() && !source.ref && (
          <span className="text-xs text-red-500">
            {t("that-is-not-a-youtube")}</span>
        )}
      </label>

      {/* The preview is the timestamp field: scrub to where the battle starts
          instead of going back to YouTube to read the clock. The text input
          stays, for pasting a time someone already has. */}
      {source.ref && (
        <VideoScrubber
          videoId={source.ref.videoId}
          seconds={source.seconds ?? 0}
          onChange={(s) => source.setStart(formatTimestamp(s))}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {tCopy("battle-starts-at")}{" "}
            <span className="font-normal text-fd-muted-foreground">
              {tCopy("optional")}
            </span>
          </span>
          <input
            type="text"
            value={source.value}
            onChange={(e) => source.setStart(e.target.value)}
            placeholder="1:05:30"
            inputMode="numeric"
            className={INPUT}
          />
          {source.invalid ? (
            <span className="text-xs text-red-500">
              {t("use-a-time-like-1")}</span>
          ) : source.missing ? (
            <span className="text-xs text-amber-500">
              {t("your-link-has-no-timestamp")}</span>
          ) : null}
        </label>
        {children}
      </div>
    </>
  );
}

export { INPUT as VIDEO_FORM_INPUT };
