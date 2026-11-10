"use client";

import { usePathname } from "@/hooks/use-pathname";
import { useRouter } from "@/hooks/use-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useManeuversEdition } from "@/components/maneuvers/edition-context";
import { maneuversEditionName } from "@/components/maneuvers/edition-name";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Edition picker for a Maneuvers board header, the Onslaught season picker's
 * twin. It lists every edition the event has run: the ones we recorded are
 * selectable, the rest render disabled, since the source keeps nothing once an
 * edition ends and an edition nobody captured is gone. Navigates to
 * `?edition=<id>`, or to the clean path for the newest recorded edition.
 */
export function ManeuversEditionSelect() {
  const { t } = useTranslation("components/maneuvers/edition-name");
  const { board, requested } = useManeuversEdition();
  const router = useRouter();
  const pathname = usePathname();
  const { editions } = board;
  if (editions.length === 0) return null;

  const latest = editions.find((e) => e.available)?.eventName ?? null;
  const onChange = (eventName: string) => {
    router.push(
      eventName === latest
        ? pathname
        : `${pathname}?edition=${encodeURIComponent(eventName)}`,
    );
  };

  return (
    <Select value={requested ?? latest ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="w-48 rounded-md bg-transparent py-0 text-xs data-[size=sm]:h-7 dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {editions.map((e) => (
          <SelectItem key={e.eventName} value={e.eventName} disabled={!e.available}>
            {maneuversEditionName(e.eventName, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
