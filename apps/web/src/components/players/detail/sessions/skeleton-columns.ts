import type { SkeletonColumn } from "@/components/table-skeleton";

// Widths mirroring PlayerSessionsTable, for the on-demand loading placeholder.
// A neutral (non-"use client") module for the same reason as the tank list's:
// a plain array cannot cross the client boundary, so both the tabs view and any
// server-rendered placeholder import this one.
export const SESSIONS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-32" }, // Date
  { width: "w-12", align: "right" }, // Battles
  { width: "w-8", align: "right" }, // Tier
  { width: "w-8", align: "right" }, // Tanks
  { width: "w-14", align: "right" }, // Rating
  { width: "w-12", align: "right" }, // WR
  { width: "w-12", align: "right" }, // DPG
  { width: "w-10", align: "right" }, // Frags
  { width: "w-10", align: "right" }, // DD/DR
  { width: "w-10", align: "right" }, // K/D
  { width: "w-12", align: "right" }, // Survival
  { width: "w-10", align: "right" }, // Spots
  { width: "w-10", align: "right" }, // Decap
  { width: "w-12", align: "right" }, // XP
];
