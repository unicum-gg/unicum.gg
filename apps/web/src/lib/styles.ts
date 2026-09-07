export const styles = {
  mutedText: "text-fd-muted-foreground",
  mutedHoverText: "text-fd-muted-foreground hover:text-fd-foreground",

  border: "border-fd-border",
  borderX: "border-x border-fd-border",

  screenLines: "screen-line-before screen-line-after",

  colorTransition: "transition-colors",

  cardBorder: "border border-fd-border",
  mutedDescription: "text-sm text-fd-muted-foreground",
  linkHover: "text-fd-muted-foreground hover:text-fd-foreground transition-colors",

  /**
   * A table column a phone does without, in a table that sizes itself from its
   * content. The cell leaves the row and takes its column with it.
   */
  hiddenColumn: "hidden sm:table-cell",

  /**
   * The same, in a table whose widths come from a fixed `<colgroup>`.
   *
   * These must be made invisible rather than removed. A cell dropped with
   * `display: none` leaves the row entirely, and cells are mapped onto the
   * colgroup by position, so every cell after it slides into the columns it
   * vacated: the profile's "Last 30d" figures landed in the zero-width columns
   * meant for "Last 24h" and were painted on top of each other. Invisible, the
   * cell keeps its column and draws nothing, its border and rating tint
   * included.
   *
   * `overflow-hidden` is the other half and is not decoration: an invisible box
   * is still laid out, so its text runs past a zero-width column and counts
   * towards the table's scroll width. Six collapsed columns of unpainted
   * figures gave the table 77px of horizontal scroll over nothing at all.
   */
  hiddenFixedColumn: "max-sm:invisible max-sm:overflow-hidden",
} as const;
