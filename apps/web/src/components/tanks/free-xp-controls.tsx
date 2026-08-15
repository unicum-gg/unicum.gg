"use client";

import { toRoman } from "roman-numerals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * "Free XP from tier N" picker. `maxTier` caps the options to the tank's own
 * tier - 1 on a detail page (you can't free-XP from your own tier), or 10 on the
 * economics table where it's a global setting. Cookie-backed value lives in the
 * caller (`useFreeXpSettings`) so the tank page and the table stay in sync.
 */
export function FreeXpTierSelect({
  value,
  onChange,
  maxTier = 10,
  triggerClassName,
}: {
  value: number;
  onChange: (tier: number) => void;
  maxTier?: number;
  triggerClassName?: string;
}) {
  const tiers = Array.from(
    { length: Math.max(1, maxTier) },
    (_, i) => i + 1,
  );
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger
        size="sm"
        aria-label="Free XP from tier"
        className={cn(
          "h-6! w-fit gap-1 px-1.5! py-0! text-xs [&_svg]:size-3",
          triggerClassName,
        )}
      >
        <SelectValue>{`T${value}`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tiers.map((t) => (
          <SelectItem key={t} value={String(t)}>
            Tier {toRoman(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** XP-to-gold rate field (default 25, editable for WG promos like 40). */
export function XpRateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="XP per gold rate"
      className={cn(
        "w-10 rounded border border-current/30 bg-transparent px-1 py-0.5 text-center text-xs tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
    />
  );
}
