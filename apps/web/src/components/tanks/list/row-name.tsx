import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import { CommonTestBadge } from "@/components/entity/badges/common-test-badge";
import { TankIcon } from "@/components/tanks/tank-icon";
import ROUTES from "@/constants/routes";

/**
 * A tank's name cell in the catalogue tables: icon, name, and the crests that
 * apply. Every tab renders the same cell, so it lives here rather than five
 * times over, which is how the Common Test crest reaches all of them at once.
 */
export function TankRowName({
  region,
  tank,
}: {
  region: Region;
  tank: {
    slug: string;
    tag: string;
    type: string;
    nation: string;
    name: string;
    shortName: string;
    isCommonTest?: boolean;
    testChanges?: number;
  };
}) {
  return (
    <Link
      href={ROUTES.TANK(region, tank.slug)}
      className="flex items-center gap-2 hover:underline"
    >
      <TankIcon
        region={region}
        tag={tank.tag}
        type={tank.type}
        nation={tank.nation}
        isCommonTest={tank.isCommonTest}
        className="h-3.5 w-auto shrink-0 object-contain"
      />
      <span className="min-w-0 truncate">{tank.shortName || tank.name}</span>
      {/* Either side of a test: a vehicle it adds, or one it rebalances. The
          tooltip says which, since the crest cannot. */}
      {tank.isCommonTest ? (
        <CommonTestBadge size={13} />
      ) : tank.testChanges ? (
        <CommonTestBadge size={13} changes={tank.testChanges} />
      ) : null}
    </Link>
  );
}
