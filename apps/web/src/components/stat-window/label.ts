"use client";

import { useCallback } from "react";
import { StatWindowUnit, type StatWindow } from "@unicum.gg/shared";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";

/**
 * A period column's heading, from its window: "Last 24h" for one day,
 * "Last 7d", "1,000 battles". Shared by every table with settable columns
 * and the phone's column picker, which name the same three.
 */
export function useStatWindowLabel(): (window: StatWindow) => string {
  const { t } = useTranslation("components/stat-window/label");
  const { num } = useFormat();
  return useCallback(
    (w: StatWindow) => {
      const count = num({ maximumFractionDigits: 0 }).format(w.value);
      if (w.unit === StatWindowUnit.Days) {
        return w.value === 1 ? t("day") : t("days", { count });
      }
      return w.value === 1 ? t("battle") : t("battles", { count });
    },
    [t, num],
  );
}
