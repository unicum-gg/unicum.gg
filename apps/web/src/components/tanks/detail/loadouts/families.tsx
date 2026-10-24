"use client";

import { useState } from "react";
import Image from "next/image";
import { isConfidentSample } from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";
import { LoadoutTable } from "./loadout-table";
import type { LoadoutTableRow } from "./view";

/**
 * Several answers to the same question, as one panel with a switch rather than
 * a panel each down the page: the four things a vehicle carries, or the seats
 * of its crew.
 *
 * Stacked, they were four headings and four half-empty lists a reader had to
 * scroll past to compare anything. They answer the same question in the same
 * columns, so they belong in the same table, with the switch in the panel's
 * heading where every other panel on the site keeps the control that changes
 * what it shows.
 *
 * A family with nothing to show gets no segment at all. An empty one is a
 * control that punishes the reader for pressing it, and on most vehicles today
 * the directives would be exactly that.
 */
export function LoadoutFamilies({
  title,
  families,
  sample,
  confident,
  labels,
}: {
  title: string;
  families: {
    id: string;
    label: string;
    /** How this family is counted, said under the heading. */
    description: string;
    rows: LoadoutTableRow[];
    /** What this family's shares are over, when it is not the panel's: a
     * crew seat's skills are shared over the players who have that seat. */
    sample?: number;
    /** A picture beside the label in the switch: a crew seat's badge. */
    icon?: string | null;
  }[];
  sample: number;
  confident: boolean;
  labels: React.ComponentProps<typeof LoadoutTable>["labels"];
}) {
  const shown = families.filter((family) => family.rows.length > 0);
  const [active, setActive] = useState(shown[0]?.id ?? "");
  if (shown.length === 0) return null;
  const current = shown.find((family) => family.id === active) ?? shown[0]!;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>{title}</PanelTitle>
        {shown.length > 1 ? (
          <SegmentedControl
            active={current.id}
            onSelect={setActive}
            segments={shown.map((family) => ({
              id: family.id,
              label: family.label,
              count: family.rows.length,
              icon: family.icon ? (
                // Inverted in the dark theme: the game's role badge is a
                // near-black glyph made for a light portrait.
                <Image
                  src={family.icon}
                  alt=""
                  width={14}
                  height={14}
                  className="size-3.5 object-contain dark:invert"
                />
              ) : undefined,
            }))}
          />
        ) : null}
      </PanelHeader>
      <PanelContent className="p-0">
        <p className="px-4 py-3 text-sm text-fd-muted-foreground">
          {current.description}
        </p>
        <LoadoutTable
          key={current.id}
          rows={current.rows}
          sample={current.sample ?? sample}
          confident={current.sample == null ? confident : isConfidentSample(current.sample)}
          labels={labels}
        />
      </PanelContent>
    </Panel>
  );
}
