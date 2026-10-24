"use client";

import { useState } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";

/** One battle mode: its switch label, its players, its note and its panels. */
export interface ModeView {
  label: string;
  players: number;
  note: React.ReactNode;
  panel: React.ReactNode;
}

/**
 * The tab's own heading, and the battle mode it shows.
 *
 * The switch sits in the heading's panel, beside the title, the way every other
 * panel on the site carries the control that changes what it shows.
 *
 * Every mode is rendered on the server and shipped together, and this picks
 * between them. That is not an optimisation, it is the only shape that works:
 * the catalogues naming every device, directive and crew perk in the reader's
 * language are stripped before the dictionaries cross the wire, so a client
 * that refetched on toggle would be handed a payload of client keys it cannot
 * name. The leaderboards do the same with their three rating metrics.
 *
 * Only the modes that hold battles are passed in, and with a single one the
 * switch is not drawn at all.
 */
export function LoadoutsSwitch({
  title,
  modes,
  initial,
}: {
  title: string;
  /** Only the modes with battles, in the order of the switch. */
  modes: ModeView[];
  /** The mode to open on: the one with the most players for this vehicle. */
  initial: number;
}) {
  const [mode, setMode] = useState(String(initial));

  return (
    <>
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>{title}</PanelTitle>
          {modes.length > 1 ? (
            <SegmentedControl
              active={mode}
              onSelect={setMode}
              segments={modes.map((view, index) => ({
                id: String(index),
                label: view.label,
                count: view.players,
              }))}
            />
          ) : null}
        </PanelHeader>
        {modes.map((view, index) => (
          <PanelContent key={index} hidden={String(index) !== mode}>
            {view.note}
          </PanelContent>
        ))}
      </Panel>

      {/* Every mode stays mounted and hidden rather than being unmounted, so
          switching back does not re-run the images: they are all already in
          the document, which is the whole reason they were rendered together. */}
      {modes.map((view, index) => (
        <div key={index} hidden={String(index) !== mode}>
          <PanelSeparator />
          {view.panel}
        </div>
      ))}
    </>
  );
}
