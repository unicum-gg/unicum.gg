"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

function formatRelative(date: Date, now: number): string {
  const diffMs = now - date.getTime();
  const future = diffMs < 0;
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 60) {
    if (absSeconds <= 1) return future ? "in a moment" : "just now";
    return future ? `in ${absSeconds} seconds` : `${absSeconds} seconds ago`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

export function RelativeTime({
  date,
  title,
  className,
}: {
  date: Date;
  title?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => date.getTime());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <time className={className} dateTime={date.toISOString()} title={title}>
      {formatRelative(date, now)}
    </time>
  );
}
