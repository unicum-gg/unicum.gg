import { GlossaryLabel } from "@/components/glossary/label";

/**
 * A vehicle's name, with the parallel-catalogue suffix it may end with marked
 * as the term it is.
 *
 * The suffix is ours, not Wargaming's: it is appended so a reissue does not
 * collide with the vehicle it duplicates, which leaves an acronym in the title
 * that the game itself never explains. Splitting on `variant` rather than on
 * the text means the mark and the name can never disagree, and a catalogue we
 * have not seen yet is marked the day it ships rather than when someone
 * remembers to add it here.
 *
 * A variant nothing defines renders as plain text, exactly like the name did
 * before, so this is safe to leave in place ahead of the glossary entry.
 */
export function VehicleName({
  name,
  variant,
}: {
  name: string;
  variant: string | null;
}) {
  if (!variant || !name.endsWith(` ${variant}`)) return <>{name}</>;
  return (
    <>
      {name.slice(0, -variant.length)}
      <GlossaryLabel label={variant}>{variant}</GlossaryLabel>
    </>
  );
}
