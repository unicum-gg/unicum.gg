import { CommonTestBadge } from "@/components/entity/badges/common-test-badge";

/**
 * The Common Test crest as a map wears it: on a space the live client declares
 * but does not ship, so it exists only on the test client.
 *
 * It marks two things with one sentence, because to a reader they are the same
 * thing: a whole map the live client cannot load (the Waffenträger reskins, the
 * arcade arenas) and a map whose night version it cannot. Hence "this version"
 * rather than "this map".
 *
 * One component rather than the sentence repeated at each of the four places it
 * appears (the gallery card, the detail page's view pill, its history section
 * and the global feed's rows), so they cannot drift apart.
 */
export function MapCommonTestBadge({ size = 14 }: { size?: number }) {
  return (
    <CommonTestBadge
      size={size}
      description="only the test client ships this version, so it cannot be played on the live server yet"
    />
  );
}
