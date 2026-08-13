"use client";

import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { RatingSelector } from "@/components/rating-selector";
import { RegionSelector } from "@/components/region-selector";
import APP from "@/constants/app";
import { openCookiePreferences } from "@/lib/cookie-preferences";
import { styles } from "@/lib/styles";

/**
 * The line under the columns: who owns the page on the left, what the reader can
 * change about it on the right.
 *
 * The three controls are the navbar's own components, not copies. A footer is
 * where a reader lands after a long table, and sending them back to the top to
 * switch server is the kind of trip a second control removes. Sharing the
 * component means the two can never disagree about the current value: both read
 * the same cookie, and the theme switch the same `next-themes` state.
 */
export function FooterBottomBar() {
  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-fd-border px-4 py-4 text-sm sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center sm:justify-start sm:text-left">
        <span className={styles.mutedText}>
          © {new Date().getFullYear()} {APP.NAME}
        </span>
        <span className={styles.mutedText} aria-hidden>
          ·
        </span>
        <span className={styles.mutedText}>Not affiliated with Wargaming</span>
        <span className={styles.mutedText} aria-hidden>
          ·
        </span>
        {/* The only way back to the consent choices once they are made: the
            banner hides itself for good after an answer. */}
        <button
          type="button"
          onClick={openCookiePreferences}
          className={`cursor-pointer ${styles.linkHover}`}
        >
          Manage cookies
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeSwitch />
        <RatingSelector />
        <RegionSelector />
      </div>
    </div>
  );
}
