"use client";

import { useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { Button } from "@/components/ui/button";
import type { TournamentRulesSection } from "./record";

/**
 * The organiser's rules, as they wrote them.
 *
 * Worth rendering rather than dropping, because this is where the questions a
 * competitor actually has are answered, and the side convention above all: which
 * slot starts at which base, and on which maps that is reversed. The bracket can
 * say a team played slot 1; only the rules say what slot 1 means on Sand River.
 *
 * Collapsed by default: it runs to several screens on a clan championship, and
 * the bracket is what most readers came for.
 */
export function TournamentRules({
  sections,
  otherRules,
}: {
  sections: TournamentRulesSection[];
  otherRules?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (sections.length === 0 && !otherRules) return null;

  return (
    <Panel>
      <PanelHeader
        screenLines={false}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
      >
        <PanelTitle>Rules</PanelTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show rules"}
        </Button>
      </PanelHeader>
      {open && (
        <PanelContent className="flex flex-col gap-6">
          {sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section, i) => (
              // Keyed by position: `order` is the organiser's own numbering and
              // it repeats, the same trap as the prize bands.
              <section key={i} className="flex flex-col gap-2">
                {section.title && (
                  <h3 className="font-semibold">{section.title}</h3>
                )}
                <div
                  className="prose prose-sm max-w-none text-fd-muted-foreground prose-a:text-brand prose-strong:text-fd-foreground"
                  // Sanitized by the endpoint (core `tournaments/sanitize`), so
                  // what arrives here is already a safe tag subset.
                  dangerouslySetInnerHTML={{ __html: section.description }}
                />
              </section>
            ))}
          {otherRules && (
            <p className="text-sm whitespace-pre-line text-fd-muted-foreground">
              {otherRules}
            </p>
          )}
        </PanelContent>
      )}
    </Panel>
  );
}
