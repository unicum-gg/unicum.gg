import { cache } from "react";
import type { Region } from "@unicum.gg/wargaming";
import type { BattleDetail } from "@unicum.gg/core/battles/read";
import { UnicumError } from "@unicum.gg/sdk";
import { unicum } from "@/services/sdk";
import type { CommentsPayload } from "./comments";

/**
 * A battle as its own endpoint answers it, read once per render for the
 * metadata and the page: React's `cache` makes the second call within one
 * request the first one's answer (and Next memoises the fetch underneath).
 *
 * Through the SDK like every page, never the database: the payload is the very
 * one the client component would otherwise ask for, so it is handed to it whole
 * and the battle is in the HTML. Null for an unknown battle.
 */
export const loadBattle = cache(
  async (region: Region, id: string, locale: string): Promise<BattleDetail | null> => {
    if (!/^[0-9]{1,20}$/.test(id)) return null;
    try {
      // The endpoint's payload is the core type over JSON, its dates revived
      // by the SDK.
      return (await unicum
        .region(region)
        .battles(id)
        .detail(locale)) as unknown as BattleDetail;
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) return null;
      throw error;
    }
  },
);

/**
 * The battle's published comments, as anybody is shown them, for the HTML. A
 * reader's own unpublished ones are added by the browser, which knows who is
 * reading; a server render has no session to ask for them with. Null when the
 * read fails: the section then fills itself in on the client.
 */
export const loadComments = cache(async (region: Region, id: string) =>
  unicum
    .region(region)
    .battles(id)
    .comments()
    // The status enum is nominal on each side of HTTP, so the payload is
    // named as the component reads it.
    .then((payload) => payload as unknown as CommentsPayload)
    .catch(() => null),
);
