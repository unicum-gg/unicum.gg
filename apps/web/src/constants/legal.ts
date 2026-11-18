import APP from "@/constants/app";

/**
 * The facts the legal pages state, kept as data rather than inside the copy.
 *
 * None of them is translated: a SIRET or a postal address reads the same in
 * every language, and a translator handed one inside a sentence can only get it
 * wrong. The sentences around them name them through placeholders.
 *
 * `ADDRESS` is the business's, never a home: an individual entrepreneur may
 * publish a domiciliation address. A fact left empty drops the line that names
 * it from the documents (see `dropEmptyLines`), so a missing one is absent
 * rather than published as a placeholder.
 */
const LEGAL = {
  /** When the three documents last changed. Bump it with any change to their
   * English, since it is what a reader is told they agreed to. */
  LAST_UPDATED: "2026-11-18",
  PUBLISHER: {
    NAME: "Antoine Kingue EI",
    DIRECTOR: "Antoine Kingue",
    SIREN: "103 960 779",
    SIRET: "103 960 779 00017",
    ADDRESS: "",
    PHONE: "+33 6 99 72 53 58",
    EMAIL: APP.CONTACT.EMAIL,
  },
  HOST: {
    NAME: "netcup GmbH",
    ADDRESS: "Emmy-Noether-Straße 10, 76131 Karlsruhe, Germany",
    PHONE: "+49 721 7540755 0",
    URL: "https://www.netcup.com",
  },
  /** The consumer mediator the supporter pledges answer to, which French law
   * requires of anyone selling to consumers. */
  MEDIATOR: {
    NAME: "",
    URL: "",
  },
  CNIL_URL: "https://www.cnil.fr/en/complaints",
  POLICIES: {
    WARGAMING: "https://legal.eu.wargaming.net/en/privacy-policy/",
    STRIPE: "https://stripe.com/privacy",
    GOOGLE: "https://policies.google.com/privacy",
    UMAMI: "https://umami.is/privacy",
    CLOUDFLARE: "https://www.cloudflare.com/privacypolicy/",
    DISCORD: "https://discord.com/privacy",
    TWITCH: "https://www.twitch.tv/p/legal/privacy-notice/",
  },
};

export default LEGAL;
