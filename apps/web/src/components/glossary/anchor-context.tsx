"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  GlossaryAnchorPayload,
  GlossaryTooltipTerm,
} from "@unicum.gg/shared";
import { TooltipProvider } from "@/components/ui/tooltip";

type Lookup = (anchor: { specKey?: string; label?: string }) => GlossaryTooltipTerm | null;

const GlossaryAnchorContext = createContext<Lookup>(() => null);

/**
 * Puts the glossary's anchors within reach of every component on the page.
 *
 * A context rather than props threaded down: the labels that need explaining
 * live inside deeply nested client components (the specifications table, the
 * leaderboard headers), and passing a definition through each of them would
 * make every table's props depend on the glossary. The payload holds only the
 * anchored terms, once each, so it costs a few kilobytes on the wire.
 */
export function GlossaryAnchorProvider({
  payload,
  children,
}: {
  payload: GlossaryAnchorPayload;
  children: ReactNode;
}) {
  const lookup = useMemo<Lookup>(() => {
    const bySlug = new Map(payload.terms.map((term) => [term.slug, term]));
    // The label wins over the column: a reader clicks the words in front of
    // them, so "Dispersion" must lead to Dispersion even though the value comes
    // from the column Accuracy defines. The column is what catches the rows
    // whose label is only a variant ("… moving").
    return ({ specKey, label }) => {
      const slug =
        (label ? payload.byLabel[label.toLowerCase()] : undefined) ??
        (specKey ? payload.bySpecKey[specKey] : undefined);
      return slug ? (bySlug.get(slug) ?? null) : null;
    };
  }, [payload]);

  return (
    <GlossaryAnchorContext.Provider value={lookup}>
      <TooltipProvider>{children}</TooltipProvider>
    </GlossaryAnchorContext.Provider>
  );
}

/** Resolve one anchor to its term, by specification column or by label. Returns
 * null when nothing defines it, which is the common case and renders as plain
 * text. */
export function useGlossaryAnchor(): Lookup {
  return useContext(GlossaryAnchorContext);
}
