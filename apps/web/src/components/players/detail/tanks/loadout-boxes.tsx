"use client";

import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The boxes a loadout is drawn as, and the only part of it that is a client
 * component.
 *
 * The split is not decoration. Everything that NAMES a thing happens on the
 * server, in `loadout-panel.tsx`, because the catalogues that name equipment
 * and crew perks never cross the wire. Everything that REACTS to a pointer
 * happens here, because a tooltip is interaction.
 *
 * Measured, and this is why the file exists: rendering the Radix tooltips
 * from inside the server component cost the server rendering of everything
 * they wrapped. The panel came back with one box out of forty-seven and five
 * empty crew rows, and the rest appeared only once hydration had run, which
 * is exactly what a reader notices as "it arrives after the page". With the
 * tooltips removed the same panel server-rendered all forty-seven. So the
 * boxes are drawn here, from data the server already resolved, and they
 * render on both sides.
 */

/** One slot: what is in it, or nothing. */
export interface LoadoutSlotView {
  /**
   * Whether the slot is occupied, when the name cannot say.
   *
   * The garage knows a slot is filled because it has a name for what is in
   * it. A battle row has no names at all -- translating them would make the
   * whole list vary by language -- so it says so here instead. Left out, the
   * name and the picture decide, which is what every caller did before.
   */
  filled?: boolean;
  /** The game's own name, or null for a free slot. */
  name: string | null;
  image: string | null;
  /** The grade badge the game composites on bond, bounty or experimental gear. */
  overlay?: string | null;
  /** Equipment 2.0 categories, drawn as the game's coloured dots. */
  categories?: string[];
}

/** One kind of round the gun fires, and how many are loaded. */
export interface LoadoutShellView {
  id: number;
  kind: string;
  count: number;
  premium: boolean;
  image: string;
}

/** One seat: who is in it, then what they were taught. */
export interface LoadoutCrewView {
  role: string;
  roleImage: string | null;
  /** The vehicle has this seat and the player has never put anybody in it. */
  empty?: boolean;
  /** What the tooltip says about an empty one. */
  emptyLabel?: string;
  /** Perks in lines: the universal ones, then one line per role of the seat. */
  skillLines: { key: string; skills: { name: string; image: string }[] }[];
}

export function SlotGroup({
  label,
  layouts,
  active,
}: {
  label: string;
  /** One entry per setup the vehicle carries; usually one. */
  layouts: LoadoutSlotView[][];
  active: number;
}) {
  return (
    <Group label={label}>
      <Layouts count={layouts.length} active={active}>
        {layouts.map((slots, layout) => (
          <Row key={layout}>
            {slots.map((slot, index) => (
              <LoadoutSlotBox key={index} slot={slot} />
            ))}
          </Row>
        ))}
      </Layouts>
    </Group>
  );
}

/**
 * One loadout slot, filled or free, at whatever size the caller draws at.
 *
 * The single slot in the application, deliberately. There were two for a
 * while: this one on the garage panel and a hand-rolled square on the battle
 * rows, and the copy immediately drifted -- it lost the grade badge that
 * tells a Bounty Rammer from an ordinary one, and the category dots, so the
 * same device looked like two different things on two pages. Anything that
 * draws a fitted item goes through here.
 *
 * `size` scales the frame, the picture and the badge together. The name is
 * drawn inside the box as a last resort when Wargaming publishes no picture,
 * which only a box big enough to hold words can do; below that the box stays
 * filled and empty-looking, which still says "something is here".
 */
export function LoadoutSlotBox({
  slot,
  size = 40,
  subdued,
  pictureClassName,
}: {
  slot: LoadoutSlotView;
  size?: number;
  /** The thin frame the crew perks are drawn in, for a box that sits in a run
   * of many rather than as one of three slots. */
  subdued?: boolean;
  /** Passed to the picture: the crew role badge needs `dark:invert`. */
  pictureClassName?: string;
}) {
  const filled = slot.filled ?? !!(slot.name || slot.image);
  return (
    <Box
      tip={slot.name ?? undefined}
      filled={filled}
      overlay={slot.overlay}
      categories={slot.categories}
      size={size}
      subdued={subdued}
    >
      {slot.image ? (
        <Picture
          src={slot.image}
          alt={slot.name ?? ""}
          size={Math.round(size * 0.65)}
          className={pictureClassName}
        />
      ) : slot.name && size >= 32 ? (
        // Wargaming publishes no picture for this one. Its name is still the
        // answer, so the box carries it rather than a hole.
        <span className="px-0.5 text-center text-[8px] leading-tight text-fd-muted-foreground">
          {slot.name}
        </span>
      ) : null}
    </Box>
  );
}

export function ShellGroup({
  label,
  layouts,
  active,
}: {
  label: string;
  layouts: { shells: LoadoutShellView[]; goldPercent: number | null }[];
  active: number;
}) {
  return (
    <Group label={label}>
      <Layouts count={layouts.length} active={active}>
        {layouts.map((layout, index) => (
          <Row key={index}>
            {layout.shells.map((shell) => (
              <LoadoutShellBox key={shell.id} shell={shell} />
            ))}
            {layout.goldPercent !== null && layout.goldPercent > 0 ? (
              <span className="self-center pl-1 text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {layout.goldPercent}%
              </span>
            ) : null}
          </Row>
        ))}
      </Layouts>
    </Group>
  );
}

/**
 * One kind of round and how many are loaded, with the count on the box where
 * the game itself puts it. Exported for the tank page's builds list, so a rack
 * reads the same on both pages.
 */
export function LoadoutShellBox({
  shell,
  size = BOX,
}: {
  shell: Pick<LoadoutShellView, "kind" | "count" | "premium" | "image">;
  size?: number;
}) {
  return (
    <Box
      tip={`${shell.kind} x ${shell.count}`}
      filled
      size={size}
      accent={shell.premium && shell.count > 0}
      dimmed={shell.count === 0}
    >
      <Picture src={shell.image} alt={shell.kind} size={Math.round(size * 0.65)} />
      <span className="absolute -right-1 -bottom-1.5 rounded bg-fd-background px-0.5 text-[10px] leading-tight font-medium tabular-nums">
        {shell.count}
      </span>
    </Box>
  );
}

/**
 * A group's setups, one row each, numbered only when there are two.
 *
 * The number appears solely to tell them apart, so a vehicle with one setup
 * (most of a carousel) draws exactly as it did before, with no column of
 * ones down the panel. The one in use is marked rather than the other
 * dimmed: dimming already means "carries none" on a round, and a setup the
 * player is not on is still a setup they built.
 */
function Layouts({
  count,
  active,
  children,
}: {
  count: number;
  active: number;
  children: React.ReactNode[];
}) {
  if (count < 2) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1">
      {children.map((row, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-2.5 shrink-0 text-center text-[9px] leading-none font-semibold tabular-nums",
              index === active ? "text-brand" : "text-fd-muted-foreground/60",
            )}
          >
            {index + 1}
          </span>
          {row}
        </div>
      ))}
    </div>
  );
}

/** The boxes of one setup. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-start gap-1">{children}</div>;
}

export function CrewGroup({
  label,
  crew,
}: {
  label: string;
  crew: LoadoutCrewView[];
}) {
  return (
    <Group label={label}>
      <div className="flex w-full flex-col gap-2">
        {crew.map((member, index) => (
          // `items-start`, not `items-center`: a member with perks from two
          // roles carries several lines, and the badge belongs beside the
          // first of them rather than floating in the middle of the stack.
          <div key={index} className="flex items-start gap-1">
            {/* A seat nobody sits in is drawn dashed, like a free equipment
                slot and for the same reason: a row that quietly disappears
                makes "this player crews nothing here" look like "we know
                nothing about this vehicle". The two are not the same answer. */}
            <Box
              tip={member.empty ? (member.emptyLabel ?? member.role) : member.role}
              filled={!member.empty}
            >
              {member.roleImage ? (
                <Picture
                  src={member.roleImage}
                  alt={member.role}
                  size={24}
                  // Inverted in the dark theme: measured, Wargaming's role
                  // badge is a near-black glyph (rgb 36,37,35) drawn to sit
                  // on the crew member's own light portrait, so it all but
                  // vanishes on a dark panel.
                  className={cn("dark:invert", member.empty && "opacity-40")}
                />
              ) : (
                <span className="text-[8px] text-fd-muted-foreground">
                  {member.role}
                </span>
              )}
            </Box>
            {/* One line per group, as the tank page lays a member's skills
                out: the three universal perks, then the ones each role of the
                seat teaches. Run together they read as one undifferentiated
                pile, which is neither how the game shows them nor how a
                player thinks about them. */}
            <div className="flex min-w-0 flex-col gap-1">
              {member.skillLines.map((line) => (
                <div key={line.key} className="flex flex-wrap items-center gap-1">
                  {line.skills.map((skill) => (
                    <Box key={skill.name} tip={skill.name} filled subdued>
                      <Picture src={skill.image} alt={skill.name} size={24} />
                    </Box>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Group>
  );
}

/** Everything here shares one tooltip context; Radix needs a provider above. */
export function LoadoutTooltips({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={150}>{children}</TooltipProvider>;
}

/** A labelled group of boxes. */
export function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] tracking-wide uppercase text-fd-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-start gap-1">{children}</div>
    </div>
  );
}

function Picture({
  src,
  alt,
  size,
  className,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * One slot, filled or free.
 *
 * Dashed when free, like the tank page's own empty slot: three devices and two
 * devices are different builds, and a row that quietly shrinks hides which one
 * this is. A free slot carries no tooltip, having nothing to say.
 */
function Box({
  tip,
  filled,
  accent,
  subdued,
  dimmed,
  overlay,
  categories,
  size = BOX,
  children,
}: {
  tip?: string;
  filled: boolean;
  /** The box's edge in pixels. The grade badge and the dots scale with it. */
  size?: number;
  accent?: boolean;
  subdued?: boolean;
  /** Present but carrying nothing: a round the gun fires and the player does not. */
  dimmed?: boolean;
  overlay?: string | null;
  categories?: string[];
  children?: React.ReactNode;
}) {
  const small = size < BOX;
  const box = (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        small ? "rounded" : "rounded-lg",
        !filled && "border-dashed border-fd-border",
        !filled && (small ? "border" : "border-2"),
        filled && "bg-fd-secondary/30",
        filled && subdued && "border border-fd-border",
        filled && !subdued && (small ? "border" : "border-2"),
        filled && !subdued && accent && "border-amber-500/50",
        filled && !subdued && !accent && "border-fd-border",
        dimmed && "opacity-40",
      )}
    >
      {children}
      {/* The grade badge, composited on top exactly as the game does it: the
          picture underneath is the same one an ordinary device carries.

          Deliberately smaller than the tank page draws it. There the badge is
          half the box, which reads as a corner mark on a 56px tile; at the
          36px these boxes use, the same half swallowed the device it is
          supposed to qualify. It is a mark on a picture, so the picture has
          to stay the thing being looked at. */}
      {overlay ? (
        <Image
          src={overlay}
          alt=""
          aria-hidden
          width={OVERLAY}
          height={OVERLAY}
          className="pointer-events-none absolute top-0 left-0"
          style={{ width: size * OVERLAY_SHARE, height: size * OVERLAY_SHARE }}
        />
      ) : null}
      {/* Only where the box is big enough to carry them. They hang off the
          bottom edge by a fixed amount, which is a mark on a 40px tile and an
          overflowing blob on a 20px one; at that size the box is a preview and
          the category is not what it is being read for. */}
      {categories?.length && !small ? (
        <span className="absolute -bottom-1 left-1 flex gap-0.5">
          {categories.map((category) => (
            <span
              key={category}
              className="size-1.5 rounded-full ring-1 ring-fd-background"
              style={{ backgroundColor: CATEGORY_COLOR[category] ?? "#666" }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
  if (!tip) return box;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{box}</TooltipTrigger>
      <TooltipContent side="top">{tip}</TooltipContent>
    </Tooltip>
  );
}

/** The corner badge: a mark, not a second picture. */
/** The box's own edge, which everything inside it is measured against. */
const BOX = 40;
/** How much of the box the grade badge takes, kept across every size. */
const OVERLAY_SHARE = 15 / BOX;
const OVERLAY = 15;

// The site's own accent per Equipment 2.0 category (the game paints every
// specialization the same orange). Inlined rather than imported from the tank
// page's `category.ts`, which pulls a core type in behind it and would drag
// server code into this client bundle.
const CATEGORY_COLOR: Record<string, string> = {
  firepower: "#e0524c",
  mobility: "#7db61c",
  survivability: "#4a9fe0",
  stealth: "#e0b23a",
};
