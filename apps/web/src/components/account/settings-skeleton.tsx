import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape of a section before the account has been read: its rows, drawn
 * where they will land, so nothing moves when the answer arrives.
 *
 * Only for a first open with nothing preloaded. Every other open is served
 * from the shared entry and shows the real rows straight away.
 */
export function SettingsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-x-6 border-b border-fd-border py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
          <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
