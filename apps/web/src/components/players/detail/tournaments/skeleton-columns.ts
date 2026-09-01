import type { SkeletonColumn } from "@/components/table-skeleton";

// Widths mirroring PlayerTournamentsTable, for the on-demand loading
// placeholder. Neutral (non-"use client") for the same reason as the sessions
// list's: a plain array cannot cross the client boundary.
export const TOURNAMENTS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-24" }, // Date
  { width: "w-64" }, // Tournament
  { width: "w-20" }, // Mode
  { width: "w-10", align: "right" }, // Tier
  { width: "w-12", align: "right" }, // Format
  { width: "w-32" }, // Team
  { width: "w-12", align: "right" }, // Result
];
