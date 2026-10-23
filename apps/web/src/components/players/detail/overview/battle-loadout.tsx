"use client";

import type { BattleLoadoutView, BattleLoadoutSlot } from "./battle-types";
import {
  CrewGroup,
  LoadoutTooltips,
  ShellGroup,
  SlotGroup,
  type LoadoutCrewView,
  type LoadoutShellView,
  type LoadoutSlotView,
} from "@/components/players/detail/tanks/loadout-boxes";
import { useTranslation } from "@/hooks/use-translation";

/**
 * What one vehicle had fitted in this battle, drawn with the garage's own boxes.
 *
 * Not the garage, and the difference is the whole point: `tank_loadouts` says
 * what a player runs on a tank today and is replaced whenever they change it,
 * while this was read out of the battle's own recording and cannot change. A
 * page showing both without saying which is which would make a correct
 * collection look like a bug, so this one is drawn only here, under the vehicle
 * a reader opened.
 *
 * Present for very few participants, and that is the designed state rather than
 * a gap. A replay carries a loadout for the player whose client recorded it and
 * for any team mate they followed after dying; nothing is ever known this way
 * about the other team, because the server strips the devices out of every other
 * vehicle's public information before broadcasting it. So this draws nothing at
 * all far more often than it draws something, and says nothing when it has
 * nothing: an empty panel under twenty-nine of thirty vehicles would be noise,
 * and the garage panel's own "install the mod" blurb would be a lie here, since
 * no mod of ours could have collected a stranger's loadout.
 *
 * The names and the pictures arrive finished, inside the battle the page has
 * already loaded. They have to: the dictionaries that name equipment and crew
 * skills are deliberately kept off the wire, so a client component that asked
 * for one would get the key back. The battle endpoint resolves them in the
 * language the page asked for.
 */

export function BattleLoadout({
  loadouts,
  className,
}: {
  /** The participant's loadouts, one per life, as the battle endpoint names
   * them. Absent for almost every participant. */
  loadouts: BattleLoadoutView[] | undefined;
  /** How the caller places it: a column in a panel, a full row in a grid. */
  className?: string;
}) {
  const { t } = useTranslation("components/players/detail/tanks/loadout-panel");

  const panels = loadouts ?? [];
  if (panels.length === 0) return null;

  const slots = (from: BattleLoadoutSlot[]): LoadoutSlotView[] =>
    from.map((slot) => ({
      name: slot.name,
      image: slot.image,
      overlay: slot.overlay,
    }));

  return (
    <div className={className}>
      {/*
        The heading lives inside the component rather than around it. Wrapping
        it from outside would mean a caller deciding whether there is anything
        to head, which only this component knows -- and reading that by calling
        it as a plain function, as a first draft here did, runs its hooks in
        somebody else's render and is a rule violation waiting to bite.

        Headed like the panel's other blocks and not with the garage's own
        `Group`, for two reasons: that component's label is two pixels smaller
        than the headings this sits beside, and its children are laid out as a
        wrapping ROW, which is right for a line of boxes and wrong for the
        column of groups below. The groups inside still carry their own small
        labels, exactly as they do on the garage page.
      */}
      <h4 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {t("title")}
      </h4>
      {/*
        A wrapping BAND, not a stack, wherever this is drawn.
        
        The garage stacks its groups because it sits in a narrow rail and has
        no room to do otherwise. Copied here that shape was wrong twice over:
        across the width of a report the five groups made a block as tall as
        every figure in it put together, with two thirds of each line empty,
        and even in the player panel's own six-hundred-pixel column it ran to
        four hundred and fifty pixels of mostly air. Side by side they are two
        rows that say exactly the same thing, and `flex-wrap` already falls
        back to a single column on a narrow screen, so no second layout is
        needed to get that.
      */}
      <LoadoutTooltips>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {panels.map((panel) => {
          const shells: LoadoutShellView[] = panel.shells.map((shell, at) => ({
            // The boxes key a round by its id; what identifies a round here is
            // its place in the rack, which is stable and is what the client
            // itself orders them by.
            id: at,
            kind: shell.kind,
            count: shell.count,
            premium: shell.premium,
            image: shell.image,
          }));
          const crew: LoadoutCrewView[] = panel.crew.map((member) => ({
            role: member.role,
            roleImage: member.roleImage,
            // One line per seat. The garage's panel has to work out which seat
            // taught which skill from a catalogue, because the mod sends one
            // list per crew; a recording says outright, so there is nothing to
            // infer and nothing to get wrong.
            skillLines: [
              { key: member.role, skills: member.skills },
            ],
          }));
          return (
            <div
              key={panel.life}
              className="flex flex-wrap items-start gap-x-6 gap-y-3"
            >
              {panels.length > 1 ? (
                // Only when there is more than one. A battle without respawns
                // has a single loadout, and numbering it "1" would invite the
                // reader to look for a second that does not exist.
                <div className="text-muted-foreground text-xs font-medium tabular-nums">
                  {`#${panel.life + 1}`}
                </div>
              ) : null}
              {panel.optDevices.length ? (
                <SlotGroup
                  label={t("equipment")}
                  layouts={[slots(panel.optDevices)]}
                  active={0}
                />
              ) : null}
              {panel.boosters.some((slot) => slot.name) ? (
                <SlotGroup
                  label={t("directives")}
                  layouts={[slots(panel.boosters)]}
                  active={0}
                />
              ) : null}
              {panel.consumables.length ? (
                <SlotGroup
                  label={t("consumables")}
                  layouts={[slots(panel.consumables)]}
                  active={0}
                />
              ) : null}
              {shells.length ? (
                <ShellGroup
                  label={t("ammo")}
                  // No gold share. It is a figure for an aggregate to
                  // weigh, not for a reader opening one battle, and as a
                  // bare percentage beside the rounds it said nothing.
                  // The column behind it stays: that is what it is for.
                  layouts={[{ shells, goldPercent: null }]}
                  active={0}
                />
              ) : null}
              {panel.fieldMods.length ? (
                <SlotGroup
                  label={t("field-mods")}
                  layouts={[slots(panel.fieldMods)]}
                  active={0}
                />
              ) : null}
              {crew.length ? <CrewGroup label={t("crew")} crew={crew} /> : null}
            </div>
          );
        })}
        </div>
      </LoadoutTooltips>
    </div>
  );
}
