"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function AutoFitText({
  children,
  maxPx,
  minPx,
  className,
}: {
  children: React.ReactNode;
  maxPx: number;
  minPx: number;
  className?: string;
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
      const naturalW = text.scrollWidth;
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
        className="inline-block whitespace-nowrap"
        style={{ fontSize: `${maxPx}px` }}
      >
        {children}
      </span>
    </div>
  );
}
