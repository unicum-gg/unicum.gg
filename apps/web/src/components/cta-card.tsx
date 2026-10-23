import type { ReactNode } from "react";
import { styles } from "@/lib/styles";

/**
 * A centred card asking the reader to do one thing: a heading, a sentence of
 * why, and the buttons to act on it, over the brand tint.
 *
 * No hooks and no translation of its own, so a server component and a client
 * one can both render it with the words they already hold.
 */
export function CtaCard({
  heading,
  description,
  children,
  className = "",
}: {
  heading: ReactNode;
  description: ReactNode;
  /** The buttons. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${styles.cardBorder} bg-linear-to-br from-fd-primary/5 via-fd-primary/10 to-fd-primary/5 p-8 ${className}`}
    >
      <div className="absolute inset-0 bg-linear-to-br from-transparent via-fd-primary/5 to-transparent" />
      <div className="relative space-y-4 text-center">
        <h3 className="mb-2 text-xl font-semibold">{heading}</h3>
        <p className={`${styles.mutedText} mx-auto mb-6 max-w-md`}>
          {description}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      </div>
    </div>
  );
}
