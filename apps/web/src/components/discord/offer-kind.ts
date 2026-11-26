/**
 * Which Discord offer a page shows. Apart from `offer.tsx` because that module
 * is `"use client"`: a server component importing the enum from it is handed a
 * client reference rather than the value, and every kind arrives undefined.
 */
export enum DiscordOfferKind {
  Tank = "tank",
  Player = "player",
  OwnProfile = "own-profile",
}
