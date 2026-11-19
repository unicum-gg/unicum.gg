"use client";

import { minimapUrl } from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Skeleton } from "@/components/ui/skeleton";

/** One team's column while the replay loads: a line per vehicle. */
function TeamColumn({ rows }: { rows: number }) {
  return (
    <div className="border-border bg-background/40 hidden min-w-0 flex-1 basis-0 flex-col gap-2.5 rounded-lg border px-3 py-3 lg:flex">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${55 + ((index * 37) % 35)}%` }} />
          <Skeleton className="ms-auto h-3.5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * The replay's own layout while its file is fetched and decoded: both teams'
 * columns, and in the middle the score strip, the map and the transport, so
 * nothing moves when it lands. The map is the real one, dimmed: it is known
 * before the replay is, and a grey square where a battlefield belongs says
 * less than the battlefield.
 */
export function ReplaySkeleton({
  arenaId,
  mapImage,
  rows,
}: {
  arenaId: string;
  mapImage: string | null;
  /** Vehicles per team, so the columns are as tall as they will be. */
  rows: number;
}) {
  return (
    <div className="px-4 py-3" aria-busy="true">
      <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-stretch">
        <TeamColumn rows={rows} />
        <div className="border-border bg-background/40 flex w-full max-w-lg shrink-0 flex-col overflow-hidden rounded-lg border">
          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex gap-6">
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-1.5 flex-1" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="relative aspect-square w-full overflow-hidden">
            <MinimapImage
              src={mapImage ?? minimapUrl(arenaId)}
              arenaId={arenaId}
              alt={arenaId}
              sizes="512px"
              className="h-full w-full object-cover opacity-40"
            />
            <div className="bg-muted/40 absolute inset-0 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        </div>
        <TeamColumn rows={rows} />
      </div>
    </div>
  );
}
