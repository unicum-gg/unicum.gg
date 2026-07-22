import type { SkeletonColumn } from "@/components/table-skeleton";

// Column widths/alignment mirroring PlayerTanksTable, for the on-demand loading
// placeholder. Lives in this neutral (non-"use client") module so both the
// client tabs view and the server-rendered profile skeleton import the same
// array — a plain value can't cross the "use client" boundary (it would become a
// client reference, not the array).
export const TANKS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" }, // Nation
  { width: "w-6", align: "center" }, // Type
  { width: "w-6", align: "center" }, // Tier
  { width: "w-28" }, // Name
  { width: "w-6", align: "center" }, // Mastery
  { width: "w-8", align: "center" }, // Marks
  { width: "w-14", align: "right" }, // Battles
  { width: "w-12", align: "right" }, // Avg damage
  { width: "w-12", align: "right" }, // Avg XP
  { width: "w-12", align: "right" }, // Winrate
  { width: "w-14", align: "right" }, // Rating
];
