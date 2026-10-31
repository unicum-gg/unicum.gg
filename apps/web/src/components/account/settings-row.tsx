import type { ReactNode } from "react";

/**
 * One setting: what it is on the left, the control that changes it on the
 * right.
 *
 * The shape the whole dialog is laid out in, so a reader scanning the right
 * edge finds every control in one column whatever section they are in. The row
 * wraps rather than squeezing, since a description is a sentence and a phone is
 * 390px wide: the control drops under the text instead of crushing it.
 */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-fd-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-fd-foreground">{label}</div>
        {description ? (
          <p className="mt-0.5 text-xs text-fd-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
