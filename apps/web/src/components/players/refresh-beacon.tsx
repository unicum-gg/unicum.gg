"use client";

import { intervalToDuration } from "date-fns";
import { useEffect, useRef, useState } from "react";

type Phase = "refreshing" | "done" | "idle";

function formatEta(seconds: number): string {
  const { minutes = 0, seconds: s = 0 } = intervalToDuration({ start: 0, end: seconds * 1000 });
  if (minutes > 0) return `~${minutes}m${s > 0 ? `${s}s` : ""}`;
  return `~${s}s`;
}

const FALLBACK_SECONDS = 12;

export function RefreshBeacon({
  url,
  updatedAt,
}: {
  url: string;
  updatedAt: Date;
}) {
  const prevMs = useRef(updatedAt.getTime());
  const [phase, setPhase] = useState<Phase>("refreshing");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "POST" })
      .then((r) => r.json())
      .then(({ estimatedSeconds }: { estimatedSeconds: number }) => {
        if (!cancelled) setRemaining(estimatedSeconds);
      })
      .catch(() => {
        if (!cancelled) setRemaining(FALLBACK_SECONDS);
      });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => (r !== null ? r - 1 : null)), 1_000);
    return () => clearTimeout(t);
  }, [remaining]);

  useEffect(() => {
    const ms = updatedAt.getTime();
    if (ms === prevMs.current) return;
    prevMs.current = ms;
    setPhase("done");
    const t = setTimeout(() => setPhase("idle"), 3_000);
    return () => clearTimeout(t);
  }, [updatedAt]);

  if (phase === "idle") return null;
  if (phase === "done") return <span className="text-muted-foreground"> · Updated</span>;

  return (
    <span className="text-muted-foreground">
      {" · Refreshing..."}
      {remaining !== null && remaining > 0 && ` (${formatEta(remaining)})`}
    </span>
  );
}
