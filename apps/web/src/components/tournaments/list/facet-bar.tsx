"use client";

import { StarIcon } from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import { Chip, ChipRow } from "@/components/ui/chip";
import { TOURNAMENT_GAME_MODE_LABEL, teamFormat } from "@unicum.gg/shared";
import type { TournamentFacets } from "./facets";

/**
 * The catalogue's chip filters, in the shape the tank gallery uses: one row per
 * facet, a chip per value, and nothing selected means everything passes.
 *
 * Rows only render when the catalogue actually holds more than one value for
 * that facet: a region showing a single battle type has nothing to choose
 * between, and a row of one chip is a control that cannot do anything.
 */
export function TournamentFacetBar({ facets }: { facets: TournamentFacets }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {/* First, because it is the coarsest cut anyone makes here: the big
          events against the automated dailies. */}
      {facets.hasFeatured && (
        <ChipRow>
          <Chip active={facets.featuredOnly} onClick={facets.toggleFeatured}>
            <StarIcon
              weight={facets.featuredOnly ? "fill" : "regular"}
              className="size-3.5"
            />
            Featured
          </Chip>
        </ChipRow>
      )}
      {facets.modes.length > 1 && (
        <ChipRow>
          {facets.modes.map((mode) => (
            <Chip
              key={mode}
              active={facets.modesSel.has(mode)}
              onClick={() => facets.toggleMode(mode)}
            >
              {TOURNAMENT_GAME_MODE_LABEL[mode]}
            </Chip>
          ))}
        </ChipRow>
      )}
      {facets.sizes.length > 1 && (
        <ChipRow>
          {facets.sizes.map((size) => (
            <Chip
              key={size}
              active={facets.sizesSel.has(size)}
              onClick={() => facets.toggleSize(size)}
            >
              {teamFormat(size)}
            </Chip>
          ))}
        </ChipRow>
      )}
      {facets.tiers.length > 1 && (
        <ChipRow>
          {facets.tiers.map((tier) => (
            <Chip
              key={tier}
              active={facets.tiersSel.has(tier)}
              onClick={() => facets.toggleTier(tier)}
            >
              {toRoman(tier)}
            </Chip>
          ))}
        </ChipRow>
      )}
      {facets.active && (
        <button
          type="button"
          onClick={facets.clear}
          className="cursor-pointer text-fd-muted-foreground underline-offset-2 hover:text-fd-foreground hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
