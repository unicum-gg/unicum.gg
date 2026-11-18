import APP from "@/constants/app";
import LEGAL from "@/constants/legal";
import ROUTES from "@/constants/routes";

/**
 * The `{token}`s a legal document may name, in every language. A fact that
 * changes (an address, a mediator) changes here once, and no translation has
 * to be redone for it.
 */
export const LEGAL_VALUES: Record<string, string> = {
  name: APP.NAME,
  email: LEGAL.PUBLISHER.EMAIL,
  publisher: LEGAL.PUBLISHER.NAME,
  director: LEGAL.PUBLISHER.DIRECTOR,
  siren: LEGAL.PUBLISHER.SIREN,
  siret: LEGAL.PUBLISHER.SIRET,
  address: LEGAL.PUBLISHER.ADDRESS,
  phone: LEGAL.PUBLISHER.PHONE,
  "host-name": LEGAL.HOST.NAME,
  "host-address": LEGAL.HOST.ADDRESS,
  "host-phone": LEGAL.HOST.PHONE,
  "host-url": LEGAL.HOST.URL,
  "mediator-name": LEGAL.MEDIATOR.NAME,
  "mediator-url": LEGAL.MEDIATOR.URL,
  github: APP.EXTERNAL.GITHUB,
  cnil: LEGAL.CNIL_URL,
  "company-page": ROUTES.COMPANY,
  "privacy-page": ROUTES.PRIVACY,
  "terms-page": ROUTES.TERMS,
  "support-page": ROUTES.SUPPORT,
  "mod-page": ROUTES.MOD,
  "wargaming-policy": LEGAL.POLICIES.WARGAMING,
  "stripe-policy": LEGAL.POLICIES.STRIPE,
  "google-policy": LEGAL.POLICIES.GOOGLE,
  "umami-policy": LEGAL.POLICIES.UMAMI,
  "cloudflare-policy": LEGAL.POLICIES.CLOUDFLARE,
  "discord-policy": LEGAL.POLICIES.DISCORD,
  "twitch-policy": LEGAL.POLICIES.TWITCH,
};

/** Fills the tokens of a frontmatter line (the title, the description). */
export const fillLegal = (text: string) =>
  text.replace(/\{([\w-]+)\}/g, (match, name: string) => LEGAL_VALUES[name] ?? match);

/**
 * Removes every line naming a token whose value is still empty, so a fact not
 * known yet (an address being set up) leaves its list item out instead of
 * printing a label with nothing after it.
 */
export const dropEmptyLines = (markdown: string) =>
  markdown
    .split("\n")
    .filter(
      (line) =>
        ![...line.matchAll(/\{([\w-]+)\}/g)].some(
          ([, name]) => LEGAL_VALUES[name] === "",
        ),
    )
    .join("\n");
