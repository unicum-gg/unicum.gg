"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function AutoFitText({
  children,
  maxPx,
  minPx,
  className,
  allowWrap = false,
}: {
  children: React.ReactNode;
  maxPx: number;
  minPx: number;
  className?: string;
  allowWrap?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    function fit() {
      if (!container || !text) return;
      text.style.fontSize = `${maxPx}px`;
      text.style.whiteSpace = "nowrap";
      const naturalW = text.scrollWidth;
      text.style.whiteSpace = allowWrap ? "normal" : "nowrap";
      const containerW = container.clientWidth;
      if (naturalW > containerW && naturalW > 0) {
        const scaled = Math.max(minPx, (containerW / naturalW) * maxPx);
        text.style.fontSize = `${scaled}px`;
      }
    }
    fit();
    document.fonts.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  });

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <span
        ref={textRef}
        className={cn("inline-block", !allowWrap && "whitespace-nowrap")}
        style={{ fontSize: `${maxPx}px` }}
      >
        {children}
      </span>
    </div>
  );
}
