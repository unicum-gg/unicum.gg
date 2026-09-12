"use client";

import { useTranslation } from "@/hooks/use-translation";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Region } from "@unicum.gg/wargaming";
import Image from "next/image";
import useSWR from "swr";
import type { ClanSearchResult } from "@unicum.gg/shared";
import { ClanSearchPopover } from "@/components/clans/compare/clan-search-popover";
import { ClanTag } from "@/components/entity/clan-tag";
import { TankSearchPopover } from "@/components/tanks/tank-search-popover";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";

/**
 * The two fields of a suggestion that name something we already hold.
 *
 * Both were the same mistake in different places: the vehicle was never asked
 * for at all (each form implied it from the page it was opened on, which is how
 * a battle ends up under the wrong tank), and the clan was a free-text box for
 * a tag, so a typo was a credit quietly lost and anything at all could be
 * typed. Neither is something to remember and spell: both are catalogues we
 * search everywhere else on the site, through the popovers the compare pages
 * already use.
 */

/**
 * The shell both share: a label, what is currently picked, a way to clear it,
 * and the search that fills it.
 *
 * The whole field opens the search, not an icon inside it. It reads as one of
 * the form's inputs because it sits in a grid beside them, and an input is
 * clicked: a field showing "None" beside a 24px magnifier asks the reader to
 * find the one part of it that does anything.
 */
function PickerField({
  label,
  optional,
  value,
  placeholder,
  hint,
  onClear,
  search,
}: {
  label: string;
  optional?: boolean;
  /** What is picked, rendered as it should read. Null shows the placeholder. */
  value: ReactNode | null;
  placeholder: string;
  hint: string;
  onClear: () => void;
  /** The popover, handed the trigger it should wear. */
  search: (trigger: { className: string; content: ReactNode }) => ReactNode;
}) {
  const { t: tCopy } = useTranslation("components/videos/picker-field");
  return (
    // A `div`, not a `label`: the control is a button, and a label wrapping one
    // forwards its clicks to it, so clearing the field reopened the search.
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}{" "}
        {optional && (
          <span className="font-normal text-fd-muted-foreground">
            {tCopy("optional")}</span>
        )}
      </span>
      <div className="relative">
        {search({
          // Room on the right for the icons layered over it below, so a long
          // name is truncated before it reaches them rather than sliding under.
          // Every measurement here is the select primitive's, so the two read
          // as the same control in the same grid: same radius, same border,
          // same padding, same shadow. Only the right side differs, where the
          // icons below need room.
          className: cn(
            "flex h-9 w-full cursor-pointer items-center rounded-lg border border-input bg-transparent pl-2.5 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            value === null ? "pr-8" : "pr-14",
          ),
          content: (
            <span className="min-w-0 flex-1 truncate">
              {value ?? (
                <span className="text-fd-muted-foreground">{placeholder}</span>
              )}
            </span>
          ),
        })}
        {/* Both icons sit over the trigger rather than inside it, anchored to
            the edge: inside, they would be pushed off it by the padding that
            keeps the text clear of them, which left the magnifier floating in
            the middle of an empty right half. The magnifier takes no clicks of
            its own, so pressing it presses the field underneath, which is what
            it looks like it should do. */}
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
        {value !== null && (
          // A button inside a button is invalid, and the click would open the
          // search this one is meant to undo.
          <button
            type="button"
            onClick={onClear}
            aria-label={tCopy("clear-the-field", { label: label.toLowerCase() })}
            className="absolute top-1/2 right-7 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-fd-foreground"
          >
            <XIcon className="size-3.5" weight="bold" />
          </button>
        )}
      </div>
      <span className="text-xs text-fd-muted-foreground">{hint}</span>
    </div>
  );
}

/**
 * The vehicle the battle was played in.
 *
 * Required on a random battle, which is looked up by its vehicle, and left out
 * of a tactic, which belongs to the ground it was fought on.
 */
export function TankField({
  region,
  tank,
  onPick,
  onClear,
  required,
}: {
  region: Region;
  tank: { slug: string; name: string } | null;
  onPick: (tank: { slug: string; name: string }) => void;
  onClear: () => void;
  required: boolean;
}) {
  const { t } = useTranslation("components/videos/picker-field");
  return (
    <PickerField
      label={t("tank")}
      optional={!required}
      value={tank?.name ?? null}
      placeholder={required ? t("pick-the-vehicle") : t("none")}
      hint={
        required
          ? t("tank-hint-required")
          : t("tank-hint-optional")
      }
      onClear={onClear}
      search={(trigger) => (
        <TankSearchPopover
          region={region}
          onPick={(picked) => onPick({ slug: picked.slug, name: picked.name })}
          triggerAriaLabel={t("search-for-a-vehicle")}
          placeholder={t("search-tank")}
          triggerClassName={trigger.className}
          triggerContent={trigger.content}
          matchTriggerWidth
        />
      )}
    />
  );
}

/**
 * A clan as this field holds one: enough to draw it, which a tag alone is not.
 *
 * Colour and emblem are optional because one caller starts from a tag and
 * nothing else (a tactic suggested from a clan's page seeds the credit with the
 * clan whose page it is). The field resolves the rest itself in that case,
 * rather than making every page above it carry two more props for a decoration.
 */
export type ClanPick = {
  tag: string;
  color?: string | null;
  emblem?: string | null;
};

/**
 * The clan the battle was played for.
 *
 * Searched rather than typed, which is the whole point: the endpoint refuses a
 * tag it cannot resolve, so a free-text box turned a typo into a submission
 * rejected at the last step, and a tag remembered wrong into a credit given to
 * nobody. What comes out of the search exists, since it is answered from the
 * clans we track and from Wargaming's own resolution behind them.
 *
 * Scoped to the region the form is on, like the credit itself: clan ids are
 * per-region, and the tag is resolved against that region server-side.
 */
export function ClanField({
  region,
  clan,
  onPick,
  onClear,
}: {
  region: Region;
  clan: ClanPick | null;
  onPick: (clan: ClanPick) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("components/videos/picker-field");
  const painted = useClanColours(region, clan);
  return (
    <PickerField
      label={t("clan")}
      optional
      value={
        painted && (
          <span className="flex items-center gap-1.5">
            {painted.emblem && (
              <Image
                src={painted.emblem}
                alt=""
                width={16}
                height={16}
                className="size-4 shrink-0 rounded"
              />
            )}
            <ClanTag tag={painted.tag} color={painted.color ?? null} />
          </span>
        )
      }
      placeholder={t("none")}
      hint={t("credited-on-the-clan-s")}
      onClear={onClear}
      search={(trigger) => (
        <ClanSearchPopover
          region={region}
          onPick={(picked) =>
            onPick({
              tag: picked.tag,
              color: picked.color,
              emblem: picked.emblem,
            })
          }
          triggerAriaLabel={t("search-for-a-clan")}
          triggerClassName={trigger.className}
          triggerContent={trigger.content}
          matchTriggerWidth
        />
      )}
    />
  );
}

/**
 * Fills in the colour and emblem of a clan we were handed by tag alone.
 *
 * Answered by the search, which is where the clan came from in every other
 * case, so the shape is the same and SWR shares one response with the popover
 * beside it. Falls back to the bare tag: a credit that cannot be painted is
 * still a credit, and a form must not lose the clan it was seeded with because
 * a decoration failed to load.
 */
function useClanColours(region: Region, clan: ClanPick | null): ClanPick | null {
  const needsColours = Boolean(clan && clan.color === undefined);
  const { data } = useSWR(
    needsColours ? `clan-colours:${region}:${clan!.tag}` : null,
    () =>
      unicum
        .region(region)
        .clans.search(clan!.tag)
        .then((r) => (r.results as unknown as ClanSearchResult[]) ?? []),
  );
  if (!clan) return null;
  if (!needsColours) return clan;
  const found = data?.find(
    (c) => c.tag.toLowerCase() === clan.tag.toLowerCase(),
  );
  return found
    ? { tag: found.tag, color: found.color, emblem: found.emblem }
    : clan;
}
