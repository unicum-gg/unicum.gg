import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * Framework-agnostic env, shared by the Next app and the standalone worker.
 *
 * `NEXT_PUBLIC_APP_URL` is modelled as a real client var (via `clientPrefix`)
 * so `app-identity` can read it through `env` and it stays valid even when the
 * module is pulled into a browser bundle. That forces the explicit `runtimeEnv`
 * map below: env-core reads each key by computed access, and Turbopack only
 * inlines `process.env.NEXT_PUBLIC_*` on a STATIC member access, so a bare
 * `runtimeEnv: process.env` would hand env-core `undefined` on the client and
 * throw at init. Listing each var statically is exactly what `env-nextjs` does.
 */
export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    // Optional comma-separated source IPs to spread WG API + portal traffic
    // across per region (each gets its own G-Core per-IP rate budget). Every IP
    // must be a local address on the host AND whitelisted on that region's WG
    // application, else calls from it fail with INVALID_IP_ADDRESS. Unset = the
    // single default egress (current behaviour).
    WG_EGRESS_EU: z.string().optional(),
    WG_EGRESS_NA: z.string().optional(),
    WG_EGRESS_ASIA: z.string().optional(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
    // Better Auth session/cookie signing + encryption key. Optional at the env
    // layer so the worker (which never loads the auth instance) boots without
    // it; the web asserts its presence where the auth instance is created.
    BETTER_AUTH_SECRET: z.string().optional(),
    // When set, live pub/sub + the WG cache/rate-limit fan out through Redis so
    // they are shared across processes/instances. Unset = in-process (dev).
    REDIS_URL: z.string().optional(),
    // Twitch app (Confidential client) for the "top players streaming" feature:
    // an app token polls live status, and users link their channel via OAuth.
    // Optional so the app + worker boot without it (feature degrades to off).
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    // Discord application for the "Add to Discord" install flow (`/bot`): a
    // single OAuth2 authorization adds the bot to the user's server AND joins
    // them to our community server (`guilds.join`). All four are needed for the
    // flow; optional so the app/worker boot without them (the install button
    // hides and the routes 404 when unconfigured). `DISCORD_APP_ID` is the
    // public client id; the secret + bot token are real secrets.
    DISCORD_APP_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_GUILD_ID: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    WG_EGRESS_EU: process.env.WG_EGRESS_EU,
    WG_EGRESS_NA: process.env.WG_EGRESS_NA,
    WG_EGRESS_ASIA: process.env.WG_EGRESS_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    DISCORD_APP_ID: process.env.DISCORD_APP_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
