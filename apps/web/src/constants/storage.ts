const STORAGE = {
  LOCAL_STORAGE: {
    HERO_VIDEO_PLAYING: "unicum.hero-video-playing",
    COOKIE_CONSENT: "unicum.cookie-consent",
    COOKIE_PREFERENCES: "unicum.cookie-preferences",
    SEARCH_HISTORY: "unicum.search-history",
    HIDE_STREAMS: "unicum.hide-streams",
  },
  // BroadcastChannel names. Same `unicum.*` namespace as the rest: a channel
  // name is shared with every other script on the origin exactly like a storage
  // key is.
  CHANNELS: {
    STREAMERS_LIVE: "unicum.streamers-live",
    // One per region, since the counter is measured per server.
    SERVER_ONLINE: (region: string) => `unicum.server-online.${region}`,
  },
  COOKIES: {
    REGION: "unicum.region",
    RATING: "unicum.rating",
    PERIOD: "unicum.period",
    // Free-XP pricing prefs shared across the tank page + economics table: the
    // tier you free-XP from, and the XP-to-gold conversion rate (25 normally,
    // 40 during a promo, editable).
    FREE_XP_TIER: "unicum.free-xp-tier",
    XP_RATE: "unicum.xp-rate",
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
