"use client";

import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { RatingSelector } from "@/components/rating-selector";
import { LocaleSelector } from "@/components/locale-selector";
import { RegionSelector } from "@/components/region-selector";
import Link from "@/components/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
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
  const { t } = useTranslation("components/footer");

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-fd-border px-4 py-4 text-sm sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center sm:justify-start sm:text-left">
        <span className={styles.mutedText}>
          © {new Date().getFullYear()} {APP.NAME}
        </span>
        <span className={styles.mutedText} aria-hidden>
          ·
        </span>
        <span className={styles.mutedText}>{t("disclaimer")}</span>
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
          {t("cookies")}
        </button>
        {[
          { href: ROUTES.COMPANY, label: t("legal.company") },
          { href: ROUTES.PRIVACY, label: t("legal.privacy") },
          { href: ROUTES.TERMS, label: t("legal.terms") },
        ].map(({ href, label }) => (
          <span key={href} className="contents">
            <span className={styles.mutedText} aria-hidden>
              ·
            </span>
            <Link href={href} className={styles.linkHover}>
              {label}
            </Link>
          </span>
        ))}
      </div>

      {/* Wraps on a phone, where the four controls are 290px of a 288px line
          and `shrink-0` alone pushed the language picker off the edge. Above
          `sm` they share the line with the notice on the left, and there the
          notice is what gives way, so the row keeps its old behaviour. */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:shrink-0 sm:flex-nowrap">
        <ThemeSwitch />
        <RatingSelector />
        <RegionSelector />
        <LocaleSelector />
      </div>
    </div>
  );
}
