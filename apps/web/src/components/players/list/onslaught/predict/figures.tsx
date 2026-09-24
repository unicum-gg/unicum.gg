"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The two shapes the prediction asks and answers in: a labelled number field,
// and a figure with the line under it that says where the figure came from.
// Here rather than in the panel, which carries the reasoning and is long enough
// without the markup. They hold no strings of their own, so the panel keeps
// every one of them in one namespace.

export function Field({
  id,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-fd-muted-foreground">{hint}</p>
    </div>
  );
}

export function Figure({
  label,
  value,
  hint,
  icon,
  colorClass,
  input,
}: {
  label: string;
  value?: string;
  hint?: string;
  icon?: string | null;
  /** The rank's own colour, worn as a pill around the name. */
  colorClass?: string;
  input?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-fd-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
        {icon ? (
          <Image src={icon} alt="" width={32} height={32} className="h-8 w-8" />
        ) : null}
        {/* A figure the reader may correct is the field itself rather than a
            number with a box beside it, which reads as the same value twice and
            leaves it unclear which one is in force. */}
        {input ??
          (colorClass ? (
            <span className={cn("rounded px-2 py-0.5", colorClass)}>{value}</span>
          ) : (
            value
          ))}
      </dd>
      {hint ? <p className="text-xs text-fd-muted-foreground">{hint}</p> : null}
    </div>
  );
}
