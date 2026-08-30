import { CommonTestBadge } from "@/components/entity/badges/common-test-badge";

/**
 * The Common Test crest as a map wears it: on a night version the live client
 * declares but ships no space for, so it exists only on the test client.
 *
 * One component rather than the sentence repeated at each of the four places it
 * appears (the gallery card, the detail page's view pill, its history section
 * and the global feed's rows), so they cannot drift apart.
 */
export function NightCommonTestBadge({ size = 14 }: { size?: number }) {
  return (
    <CommonTestBadge
      size={size}
      description="only the test client ships this version, so it cannot be played on the live server yet"
    />
  );
}
