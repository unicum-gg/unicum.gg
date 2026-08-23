"use client";

import { BroadcastIcon, FlaskIcon } from "@phosphor-icons/react";
import { TankClient } from "@unicum.gg/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Segment,
  SegmentedControl,
} from "@/components/tanks/detail/specifications/segmented-control";

const LIVE_ICON = <BroadcastIcon className="size-3.5" weight="bold" />;
const TEST_ICON = <FlaskIcon className="size-3.5" weight="bold" />;

/**
 * Which game client the characteristics below are read from, as a compact
 * segmented toggle sat next to the characteristics title.
 *
 * A Common Test rebalances a few dozen vehicles at a time, and the table is
 * where that lands: switching to the test client re-reads the whole vehicle from
 * the test build (its modules, ammunition, crew and field modifications, not
 * only the handful of numbers the History tab lists as changed), so the setup a
 * player assembles here is the tank as the next update would ship it.
 *
 * Renders nothing for the vast majority of vehicles, which no running test
 * touches, and nothing for a test-only vehicle either: there is no live version
 * of it to switch back to.
 */
export function TankClientSwitch({
  client,
  testVersion,
  pending,
  onSelect,
}: {
  client: TankClient;
  /** The test build available for this vehicle, or null when there is none. */
  testVersion: string | null;
  /** The test client's data is still on its way. */
  pending: boolean;
  onSelect: (client: TankClient) => void;
}) {
  if (!testVersion) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <SegmentedControl>
        <Segment
          label="Live"
          icon={LIVE_ICON}
          active={client === TankClient.Live}
          onClick={() => onSelect(TankClient.Live)}
          tooltip={
            <div className="w-56 text-xs">
              The vehicle as it is in the game right now.
            </div>
          }
        />
        <Segment
          label="Common Test"
          icon={TEST_ICON}
          active={client === TankClient.CommonTest}
          disabled={pending}
          onClick={() => onSelect(TankClient.CommonTest)}
          tooltip={
            <div className="w-56 space-y-1 text-xs">
              <div className="font-medium">Common Test {testVersion}</div>
              <p className="text-background/60">
                The vehicle as the test build has it. Not released: Wargaming can
                still change or drop any of it before the update ships.
              </p>
            </div>
          }
        />
      </SegmentedControl>
    </TooltipProvider>
  );
}
