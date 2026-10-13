import { markBar, type TankMarkReach } from "@unicum.gg/shared";
import { createParamStore } from "@/lib/url-param-store";

/**
 * Which Marks of Excellence bar the vehicle table measures an account against.
 *
 * A reading of the same column rather than a filter, which is why it lives
 * here and not in `useTankFilters`: every row still shows, and what moves is
 * the bar the row's own average is divided by. `Next` is the natural reading of
 * a garage (each gun against the mark it would earn next) and the explicit
 * levels are the one the question "which of my tier 8s could go to three
 * marks" needs, since that question is asked about guns carrying no mark at
 * all, whose next mark is the first one.
 */
export enum MarkTarget {
  /** Each vehicle against the bar for the mark it would earn next. */
  Next = "next",
  One = "1",
  Two = "2",
  Three = "3",
}

/**
 * The column's heading per target, in the site's canonical English.
 *
 * Looked up through `statLabel` like every other column heading, so the words a
 * reader sees come from the shared statistics catalogue rather than from a
 * namespace of this table's own.
 */
export const MARK_TARGET_LABEL: Record<MarkTarget, string> = {
  [MarkTarget.Next]: "Next mark",
  [MarkTarget.One]: "First mark",
  [MarkTarget.Two]: "Second mark",
  [MarkTarget.Three]: "Third mark",
};

export const MARK_TARGETS: MarkTarget[] = [
  MarkTarget.Next,
  MarkTarget.One,
  MarkTarget.Two,
  MarkTarget.Three,
];

export const DEFAULT_MARK_TARGET = MarkTarget.Next;

/**
 * The target in the URL, so the view is linkable.
 *
 * That is the whole reason it is not a cookie like the column set beside it:
 * the marks panel links into this table already filtered to a tier, and the
 * only thing that turns that link into an answer is naming the bar to measure
 * against. A reader who arrives on one gets the column whether or not their
 * stored columns hold it.
 */
export const MARK_TARGET_PARAM = "mark";

const store = createParamStore(MARK_TARGET_PARAM);

export const subscribeToMarkTarget = store.subscribe;
export const writeMarkTarget = store.write;

/** The target named in the URL, or null when it names none (or names nonsense,
 * which a hand-edited address does). */
export function readMarkTarget(): MarkTarget | null {
  const raw = store.read();
  return MARK_TARGETS.find((t) => t === raw) ?? null;
}

/**
 * The mark a target names on one vehicle, or null where it names none.
 *
 * `Next` reads the gun: a vehicle carrying two marks is measured against the
 * third, one carrying none against the first, and one whose marks we have never
 * read is treated as carrying none, which is what the table shows for it
 * anyway. A gun already carrying three has no next mark at all, so the column
 * answers nothing there rather than quietly measuring it against the bar it
 * already cleared: under a heading that says "next", a figure on a finished gun
 * is a statement about a mark that does not exist. The explicit targets always
 * answer, since asking for the third mark on a three-mark gun is asking how far
 * past its own bar it plays, which is a real question.
 */
export function markFor(
  target: MarkTarget,
  marks: number | null,
): 1 | 2 | 3 | null {
  if (target !== MarkTarget.Next) return Number(target) as 1 | 2 | 3;
  const next = (marks ?? 0) + 1;
  return next <= 3 ? (next as 1 | 2 | 3) : null;
}

/** The bar a vehicle is measured against for one target, null where the target
 * names no mark on it. */
export function markBarFor(
  reach: TankMarkReach,
  target: MarkTarget,
  marks: number | null,
): number | null {
  const mark = markFor(target, marks);
  return mark == null ? null : markBar(reach, mark);
}

/**
 * How much of the target's bar an account's own average covers, 1 being the bar
 * itself. Null where the vehicle has no honest reading (see `TankMarkReach`).
 */
export function markBarRatio(
  reach: TankMarkReach | null | undefined,
  target: MarkTarget,
  marks: number | null,
): number | null {
  if (!reach) return null;
  const bar = markBarFor(reach, target, marks);
  return bar != null && bar > 0 ? reach.combined / bar : null;
}
