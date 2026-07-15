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
    // CSRF nonce for the Discord "Add to Discord" OAuth flow (/api/discord/*).
    DISCORD_OAUTH_STATE: "unicum.discord-oauth-state",
  },
};

export default STORAGE;
