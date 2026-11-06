// Everything the publisher reads from its environment, read once.
//
// Defaults live here and nowhere else, for the reason apps/sentinel's compose
// file spells out: a fallback written in compose as well as in the code is two
// values that must agree, and Coolify persists the compose one.

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const optional = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  /** The mod on wgmods.net. */
  modId: Number(optional("WGMODS_MOD_ID") ?? 7928),
  /** The Wargaming realm the account logs in on, as wgmods spells it. */
  realm: optional("WGMODS_REALM") ?? "eu",
  /** The repository whose releases are published. */
  repository: optional("GITHUB_REPOSITORY") ?? "unicum-gg/unicum.gg-mod",
  /** Shared with release.yml, which signs each publish request with it. */
  webhookSecret: required("PUBLISH_WEBHOOK_SECRET"),
  /** Opens the remote browser: /login?token=... */
  loginToken: required("LOGIN_TOKEN"),
  /** This service's public address, for the link sent when a login is needed. */
  publicUrl: required("PUBLIC_URL").replace(/\/$/, ""),
  /** Where the alerts go. Unset, they only reach the log. */
  discordWebhook: optional("DISCORD_WEBHOOK_URL"),
  /** The browser profile and the state file. A volume: it IS the session. */
  dataDir: optional("DATA_DIR") ?? "/data",
  port: Number(optional("PORT") ?? 3000),
  /** The VNC bridge started by the entrypoint, never published. */
  websockifyPort: Number(optional("WEBSOCKIFY_PORT") ?? 6080),
  /** The noVNC client the image ships. */
  novncDir: optional("NOVNC_DIR") ?? "/usr/share/novnc",
};
