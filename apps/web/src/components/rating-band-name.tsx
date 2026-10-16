import type { ReactNode } from "react";
import { RATING_COLOR_NICKNAME, type RatingColor } from "@unicum.gg/shared";

/**
 * A rating band's name followed by the players' nickname for it, as every
 * rating scale table renders its first column. The name is translated by the
 * caller, the nickname is the same in every language.
 */
export function RatingBandName({
  color,
  children,
}: {
  color: RatingColor;
  children: ReactNode;
}) {
  return (
    <>
      {children}{" "}
      <span className="font-normal opacity-80">
        ({RATING_COLOR_NICKNAME[color]})
      </span>
    </>
  );
}
