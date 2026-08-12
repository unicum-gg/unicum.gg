const STORAGE = {
  LOCAL_STORAGE: {
    HERO_VIDEO_PLAYING: "unicum.hero-video-playing",
    COOKIE_CONSENT: "unicum.cookie-consent",
    COOKIE_PREFERENCES: "unicum.cookie-preferences",
    SEARCH_HISTORY: "unicum.search-history",
    HIDE_STREAMS: "unicum.hide-streams",
  },
  COOKIES: {
    REGION: "unicum.region",
    RATING: "unicum.rating",
    PERIOD: "unicum.period",
    // Cards or table on the tank index's Videos tab.
    VIDEO_VIEW: "unicum.video-view",
    // CSRF nonce for the Discord "Add to Discord" OAuth flow (/api/discord/*).
    DISCORD_OAUTH_STATE: "unicum.discord-oauth-state",
    // Signed context {nonce, region, tag} for the boost-notification connect
    // flow, and the resulting server options carried back to the picker.
    DISCORD_BOOST_STATE: "unicum.discord-boost-state",
    DISCORD_BOOST_GUILDS: "unicum.discord-boost-guilds",
  },
};

export default STORAGE;
