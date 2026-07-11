"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Horizontal scroller for the research branch: hides the native scrollbar and
// shows round arrow buttons only on the side(s) that can still scroll.
export function ResearchRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({
      left: dir * ref.current.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex items-start overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canLeft && (
        <RailButton side="left" onClick={() => scroll(-1)} />
      )}
      {canRight && (
        <RailButton side="right" onClick={() => scroll(1)} />
      )}
    </div>
  );
}

function RailButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-fd-border bg-fd-background/90 text-fd-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-fd-muted-foreground hover:text-fd-foreground",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      {side === "left" ? (
        <CaretLeftIcon className="size-4" weight="bold" />
      ) : (
        <CaretRightIcon className="size-4" weight="bold" />
      )}
    </button>
  );
}
