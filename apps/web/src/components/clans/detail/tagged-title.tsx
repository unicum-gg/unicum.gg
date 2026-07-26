import { ClanTag } from "@/components/entity/clan-tag";

/**
 * `[TAG] {children}` fragment, its brackets tinted with the clan's own color
 * (matching the header's `[TAG]` treatment). Rendered inside a `PanelTitle` by
 * each section, so the tab panels share one tagged-title style.
 */
export function TaggedTitle({
  tag,
  color,
  children,
}: {
  tag: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ClanTag tag={tag} color={color} /> {children}
    </>
  );
}
