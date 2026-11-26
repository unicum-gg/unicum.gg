"use client";

import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A picture of the history panel, opened at full size on a click.
 *
 * Every image the panel draws (the markers' minimap, a redrawn minimap, the
 * relief and object layers) is squeezed into a column where the details it is
 * about are a few pixels wide, so each one is a button onto the same picture
 * filling the screen. The dialog names the map and the update, since a reader
 * who opens it loses the rows that said so.
 */
export function MapImageDialog({
  title,
  subtitle,
  label,
  preview,
  children,
}: {
  title: string;
  subtitle?: string;
  /** What the button does, for a reader who cannot see the picture. */
  label: string;
  /** The picture as the panel draws it, which is the button. */
  preview: ReactNode;
  /** The enlarged picture, square. */
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        // `block` because a button is inline by default, which would leave the
        // square map sitting on a text baseline inside the column.
        className="group relative block w-full cursor-zoom-in"
        aria-label={label}
      >
        {preview}
        <span className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ArrowsOutSimpleIcon className="size-4" />
        </span>
      </DialogTrigger>
      {/* Sized off the viewport's shorter side, less the heading's own height,
          so the square never pushes the dialog taller than the screen. The
          height it is allowed is the dialog's own cap (`100dvh` less its 1rem
          gutter on each side) rather than a figure of its own, or the square
          would ask for a few pixels more than the cap grants on a short
          screen and the whole dialog would scroll to give them. */}
      <DialogContent className="w-[min(95vw,calc(100dvh-7.5rem))] max-w-[min(95vw,calc(100dvh-7.5rem))] gap-0 p-0 sm:max-w-[min(95vw,calc(100dvh-7.5rem))]">
        <DialogHeader className="px-4 pt-4 pr-14 pb-3">
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="border-t border-fd-border">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
