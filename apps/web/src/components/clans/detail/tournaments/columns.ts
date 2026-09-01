import type { SkeletonColumn } from "@/components/table-skeleton";

/** Mirrors `ClanTournamentsTable`'s own columns, so the placeholder stands in
 * the same shape the rows land in. The three columns the table hides on narrow
 * screens are listed too: the skeleton is a table, so its extra cells are
 * dropped by the same breakpoints. */
export const CLAN_TOURNAMENTS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-20" }, // Date
  { width: "w-56" }, // Tournament
  { width: "w-24" }, // Played as
  { width: "w-16" }, // Status
  { width: "w-8", align: "right" }, // Tier
  { width: "w-10", align: "right" }, // Format
  { width: "w-12", align: "right" }, // Result
];
