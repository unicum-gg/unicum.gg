import {
  StatWindowUnit,
  isValidStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";

/**
 * The window a custom stats column asks for, from `days` or `battles` (exactly
 * one), or null for anything the period endpoints answer 400 to.
 */
export function statWindowOf(params: URLSearchParams): StatWindow | null {
  const days = params.get("days");
  const battles = params.get("battles");
  if ((days === null) === (battles === null)) return null;
  const w =
    days !== null
      ? { unit: StatWindowUnit.Days, value: Number(days) }
      : { unit: StatWindowUnit.Battles, value: Number(battles) };
  return isValidStatWindow(w) ? w : null;
}
