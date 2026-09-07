import type { SkeletonColumn } from "@/components/table-skeleton";

// Widths mirroring PlayerSessionsTable, for the on-demand loading placeholder.
// A neutral (non-"use client") module for the same reason as the tank list's:
// a plain array cannot cross the client boundary, so both the tabs view and any
// server-rendered placeholder import this one.
export const SESSIONS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-32" }, // Date
  { width: "w-12", align: "right" }, // Battles
  { width: "w-8", align: "right", hideOnMobile: true }, // Tier
  { width: "w-8", align: "right", hideOnMobile: true }, // Tanks
  { width: "w-14", align: "right" }, // Rating
  { width: "w-12", align: "right" }, // WR
  { width: "w-12", align: "right" }, // DPG
  { width: "w-10", align: "right", hideOnMobile: true }, // Frags
  { width: "w-10", align: "right", hideOnMobile: true }, // DD/DR
  { width: "w-10", align: "right", hideOnMobile: true }, // K/D
  { width: "w-12", align: "right", hideOnMobile: true }, // Survival
  { width: "w-10", align: "right", hideOnMobile: true }, // Spots
  { width: "w-10", align: "right", hideOnMobile: true }, // Decap
  { width: "w-12", align: "right", hideOnMobile: true }, // XP
];
