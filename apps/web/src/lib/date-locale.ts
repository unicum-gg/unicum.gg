import type { Locale as DateFnsLocale } from "date-fns";
import * as locales from "date-fns/locale";
import { Locale } from "./translations";

/**
 * The `date-fns` locale for each of ours.
 *
 * Dates on this site are formatted with `date-fns`, not `Intl`: the patterns
 * are written once ("d MMM yyyy") and the library carries the month names, so a
 * heading and a table cell agree by construction. This is the one thing it
 * needs that our locale codes do not give it.
 *
 * Named rather than derived, because the two vocabularies disagree in ways no
 * rule recovers: `date-fns` files Norwegian Bokmål under `nb`, mainland Chinese
 * under `zhCN`, and has no Tagalog at all.
 */
const DATE_FNS: Partial<Record<Locale, DateFnsLocale>> = {
  [Locale.EN]: locales.enGB,
  [Locale.FR]: locales.fr,
  [Locale.DE]: locales.de,
  [Locale.ES]: locales.es,
  [Locale.IT]: locales.it,
  [Locale.PT]: locales.pt,
  [Locale.NL]: locales.nl,
  [Locale.PL]: locales.pl,
  [Locale.SV]: locales.sv,
  [Locale.CS]: locales.cs,
  [Locale.SK]: locales.sk,
  [Locale.HU]: locales.hu,
  [Locale.RO]: locales.ro,
  [Locale.UK]: locales.uk,
  [Locale.RU]: locales.ru,
  [Locale.BE]: locales.be,
  [Locale.SR]: locales.sr,
  [Locale.HR]: locales.hr,
  [Locale.BS]: locales.bs,
  [Locale.TR]: locales.tr,
  [Locale.JA]: locales.ja,
  [Locale.KO]: locales.ko,
  [Locale.ZH]: locales.zhCN,
  [Locale.VI]: locales.vi,
  [Locale.TH]: locales.th,
  [Locale.AR]: locales.ar,
  [Locale.HI]: locales.hi,
  [Locale.BG]: locales.bg,
  [Locale.EL]: locales.el,
  [Locale.FI]: locales.fi,
  [Locale.LT]: locales.lt,
  [Locale.LV]: locales.lv,
  [Locale.DA]: locales.da,
  // Bokmål, the written standard nearly all Norwegian is published in.
  [Locale.NO]: locales.nb,
  [Locale.KK]: locales.kk,
  // Tagalog is the one language of ours `date-fns` does not ship, so its dates
  // read in English. Stated here rather than left as a silent lookup miss.
  [Locale.TL]: undefined,
};

export function dateLocale(locale: string): DateFnsLocale | undefined {
  return DATE_FNS[locale as Locale];
}
