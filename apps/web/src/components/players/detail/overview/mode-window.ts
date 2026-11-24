import { StatWindowMode } from "@unicum.gg/shared";
import { PlayerMode } from "@/components/players/detail/modes";

/**
 * Which of the profile's mode tabs can set its period columns, and which mode
 * the period endpoint reads for it. The five ended modes are absent: their
 * totals are finished, so every window over them is empty.
 */
export const STAT_WINDOW_MODE: Partial<Record<PlayerMode, StatWindowMode>> = {
  [PlayerMode.Skirmish]: StatWindowMode.Skirmish,
  [PlayerMode.Advances]: StatWindowMode.Advances,
  [PlayerMode.GrandBattles]: StatWindowMode.GrandBattles,
  [PlayerMode.RankedBattles]: StatWindowMode.Ranked,
  [PlayerMode.ClanWarsX]: StatWindowMode.ClanWarsX,
  [PlayerMode.ClanWarsVIII]: StatWindowMode.ClanWarsVIII,
  [PlayerMode.ClanWarsVI]: StatWindowMode.ClanWarsVI,
  [PlayerMode.Rampage]: StatWindowMode.Rampage,
};
