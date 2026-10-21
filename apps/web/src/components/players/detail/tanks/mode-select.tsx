"use client";

import { numberFormat } from "@/lib/format";
import { useLocale } from "@onruntime/translations/react";
import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TANK_BATTLE_MODES,
  TankBattleMode,
  type TankModeAvailability,
} from "@unicum.gg/shared";
import { tankModeName } from "@/components/game-name";

/**
 * The battle mode a record is read in.
 *
 * A select rather than a row of pills, the same control the top-players board
 * picks a language with: eleven modes is a wide panel on a page that already
 * carries four rows of filters, and this one sits beside a table that is
 * narrow on a phone.
 *
 * **Every mode is listed, and the ones with nothing behind them are disabled
 * rather than dropped.** Showing only what a player has makes the control
 * describe their account instead of the game: somebody who has never left
 * Random got no select at all and no way to learn these views exist, and a
 * vehicle record would quietly offer three modes on one tank and six on the
 * next with nothing to say why. Greyed out, the list is the same everywhere and
 * says what was not played, which is itself an answer.
 *
 * There is no "overall" entry, because there is no such mode in the game: the
 * default is Random Battles and `all` is only that plus two ladders retired a
 * decade ago. See `DEFAULT_TANK_BATTLE_MODE`.
 */
export function TankModeSelect({
  options,
  active,
  onSelect,
  className,
  label,
}: {
  /** The modes there is something to show for. Everything else in
   * `TANK_BATTLE_MODES` is still listed, disabled. */
  options: TankModeAvailability[];
  active: TankBattleMode;
  onSelect: (mode: TankBattleMode) => void;
  className?: string;
  /** The accessible name, for a copy whose heading does not give it one.
   *
   * A select reads out as its current value, so an unnamed one announces
   * "Global Map" and nothing about what that is. The table's copy sits across
   * from the count it narrows and is named by the panel's title; the record's
   * sits on a block headed for its rows rather than for the control, so it
   * carries its own. */
  label?: string;
}) {
  const { locale } = useLocale();
  const { t: tGame } = useTranslation("game/vocabulary");
  const available = new Map(options.map((option) => [option.mode, option]));

  return (
    <Select
      value={active}
      onValueChange={(value) => onSelect(value as TankBattleMode)}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        // `cn` rather than a template string: the panel overrides the width,
        // and tailwind-merge is what makes the later class actually win.
        className={cn(
          "h-8 w-56 bg-transparent text-xs dark:bg-transparent",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TANK_BATTLE_MODES.map((mode) => {
          const option = available.get(mode);
          return (
            <SelectItem
              key={mode}
              value={mode}
              // The mode the URL names is kept selectable even with nothing
              // behind it, or Radix would render the trigger blank over the
              // empty table that asked for it.
              disabled={!option && mode !== active}
            >
              <span className="flex items-center gap-2">
                <span>{tankModeName(mode, tGame)}</span>
                {option && option.tanks > 0 ? (
                  <span className="text-fd-muted-foreground/70 tabular-nums">
                    {numberFormat(locale).format(option.tanks)}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
