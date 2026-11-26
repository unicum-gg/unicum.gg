"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "@/hooks/use-translation";

const STEP = 2;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Two pictures of the same place stacked, with a bar dragged across them: left
 * of it the older one, right of it the newer.
 *
 * Side by side, a reader compares two squares by moving their eyes between
 * them and loses the spot on the way; stacked, the spot stays put and only the
 * picture over it changes. The bar follows a drag (mouse or finger), a press
 * anywhere on the picture, and the arrow keys on its handle.
 */
export function MapCompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  legend,
}: {
  before: ReactNode;
  after: ReactNode;
  beforeLabel: string;
  afterLabel: string;
  /** Drawn over both sides, along the bottom edge, so it stays put while the
   * bar moves. */
  legend?: ReactNode;
}) {
  const { t } = useTranslation("components/maps/detail/history/compare-slider");
  const [position, setPosition] = useState(50);
  const box = useRef<HTMLDivElement>(null);

  const follow = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    follow(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) follow(event.clientX);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? position - STEP
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? position + STEP
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 100
              : null;
    if (next === null) return;
    event.preventDefault();
    setPosition(clamp(next));
  };

  return (
    <div
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className="relative aspect-square w-full cursor-ew-resize touch-none overflow-hidden select-none"
    >
      <div className="absolute inset-0">{before}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        {after}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.8)]"
        style={{ left: `${position}%` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("handle")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/60 text-sm text-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-fd-primary"
        style={{ left: `${position}%` }}
      >
        <span aria-hidden>‹›</span>
      </div>
      <span className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {afterLabel}
      </span>
      {legend}
    </div>
  );
}
