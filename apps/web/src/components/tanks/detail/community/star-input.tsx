"use client";

import { useState } from "react";
import {
  MAX_STARS,
  MIN_STARS,
  RATING_COLOR_HEX,
  starRatingColor,
} from "@unicum.gg/shared";
import { cn } from "@/lib/utils";

/**
 * Five stars you can press.
 *
 * A radio group under the hood rather than five buttons, so it arrives keyboard
 * operable and screen-reader legible for free: arrow keys move through the
 * scale, the label is read out, and a form can be submitted from it. The stars
 * are the labels, which is why the inputs themselves are hidden rather than
 * absent.
 *
 * Hovering previews the value it would set. That preview is state, so this file
 * is where the client boundary sits and why the display component next door
 * stays server-rendered: the read-only stars appear eleven hundred times on the
 * site, this appears once.
 */
export function StarInput({
  name,
  value,
  onChange,
  size = 22,
  disabled,
}: {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;
  const colour = shown == null ? undefined : RATING_COLOR_HEX[starRatingColor(shown)];

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const step = MIN_STARS + i;
        const on = shown != null && step <= shown;
        return (
          <label
            key={step}
            className={cn(
              "cursor-pointer p-0.5 transition-transform",
              disabled && "cursor-not-allowed opacity-50",
              !disabled && "hover:scale-110",
            )}
            onMouseEnter={() => !disabled && setHovered(step)}
          >
            <input
              type="radio"
              name={name}
              value={step}
              checked={value === step}
              disabled={disabled}
              onChange={() => onChange(step)}
              className="sr-only"
            />
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              aria-hidden
              className={cn("block", on ? undefined : "text-fd-border")}
              style={on && colour ? { color: colour } : undefined}
              fill="currentColor"
            >
              <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94z" />
            </svg>
            <span className="sr-only">
              {step} out of {MAX_STARS}
            </span>
          </label>
        );
      })}
    </div>
  );
}
