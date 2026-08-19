import {
  displaySpecValue,
  MECHANICS_PREFIX,
  resolveTrackedField,
  SpecDirection,
} from "@unicum.gg/shared";

/** A single spec change, ready to render: labelled, formatted and coloured by
 * whether it is a buff or a nerf. Shared by the per-tank History tab and the
 * global changes feed so both read a change the same way. */
export type FormattedChange = {
  /** The raw tracked-field key (e.g. `shell:1:APCR:penetration`). Unique within a
   * tank/version, unlike `label` (two same-kind shells share a label), so it is
   * the safe React key. */
  field: string;
  label: string;
  unit?: string;
  /** Displayed before/after values (scale + precision applied), or "—". */
  before: string;
  after: string;
  /** Signed delta with the field's precision (empty when not both sides known). */
  delta: string;
  /** Tailwind text colour for a buff (emerald) or nerf (red); undefined when
   * neutral or unchanged at display precision. */
  color?: string;
  /** True buff, false nerf, null neutral / not comparable. */
  isBuff: boolean | null;
};

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function fmt(value: number | null, digits?: number): string {
  if (value === null) return "—";
  if (digits === undefined) return intFmt.format(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Turn a raw stored change (field key + before/after) into display strings,
 * applying the field's scale, unit, precision and buff/nerf direction. Returns
 * null for a field we no longer track (so an old change never renders a bare
 * column name).
 */
/** Humanize a mechanics param path into a label: `propellantAfterburnerGun/
 * chargingPerSec` -> "Propellant afterburner gun · charging per sec". */
function mechanicLabel(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      seg
        .replace(/\[(\d+)\]/g, " $1")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
        .trim(),
    )
    .join(" · ");
}

const trimFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** A tier-XI ability parameter change. No universal buff/nerf direction (each
 * mechanic is bespoke), so it renders neutral: labelled before -> after, no
 * colour. Values are exact config numbers, shown at up to 3 decimals. */
function formatMechanicChange(
  field: string,
  previous: number | null,
  next: number | null,
): FormattedChange {
  const before = previous === null ? null : Number(previous);
  const after = next === null ? null : Number(next);
  const deltaNum =
    before !== null && after !== null
      ? Number((after - before).toFixed(3))
      : null;
  return {
    field,
    label: mechanicLabel(field.slice(MECHANICS_PREFIX.length)),
    unit: undefined,
    before: before === null ? "—" : trimFmt.format(before),
    after: after === null ? "—" : trimFmt.format(after),
    delta:
      deltaNum === null || deltaNum === 0
        ? ""
        : `${deltaNum > 0 ? "+" : ""}${trimFmt.format(deltaNum)}`,
    color: undefined,
    isBuff: null,
  };
}

export function formatSpecChange(
  field: string,
  previous: number | null,
  next: number | null,
): FormattedChange | null {
  if (field.startsWith(MECHANICS_PREFIX)) {
    return formatMechanicChange(field, previous, next);
  }
  const meta = resolveTrackedField(field);
  if (!meta) return null;
  const before = displaySpecValue(meta, previous);
  const after = displaySpecValue(meta, next);
  const digits = meta.digits;

  let color: string | undefined;
  let isBuff: boolean | null = null;
  if (
    before !== null &&
    after !== null &&
    after !== before &&
    meta.direction !== SpecDirection.Neutral
  ) {
    isBuff =
      meta.direction === SpecDirection.LowerBetter
        ? after < before
        : after > before;
    color = isBuff ? "text-emerald-500" : "text-red-500";
  }

  const deltaNum =
    before !== null && after !== null
      ? Number((after - before).toFixed(digits ?? 0))
      : null;
  const delta =
    deltaNum === null ? "" : `${deltaNum > 0 ? "+" : ""}${fmt(deltaNum, digits)}`;

  return {
    field,
    label: meta.label,
    unit: meta.unit,
    before: fmt(before, digits),
    after: fmt(after, digits),
    delta,
    color,
    isBuff,
  };
}
