"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PROSE_CLASS =
  "space-y-2 text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2";

export function ExpandableDescription({
  html,
  maxLines = 10,
}: {
  html: string;
  maxLines?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setOverflows(el.scrollHeight - 1 > el.clientHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html, expanded, maxLines]);

  return (
    <div>
      <div
        ref={ref}
        className={cn(PROSE_CLASS, !expanded && "overflow-hidden")}
        style={
          expanded
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical" }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-fd-foreground hover:underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
