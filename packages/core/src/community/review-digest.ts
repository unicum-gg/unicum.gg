import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * A short fingerprint of the text a moderation card was posted about.
 *
 * Shared by every moderated written opinion, the vehicle reviews and the map
 * reviews, because the attack it closes is the same one in both and the card
 * and the approval have to hash identically or no card would ever settle.
 *
 * The card carries it and the approval checks it against what the row holds
 * now. Without it a card is just a row id, and a row's text can change after
 * the card was posted: an author could submit something reasonable, wait for
 * the card, replace it with abuse, and have a moderator working the backlog
 * publish the abuse by pressing Approve on the reasonable prose they were
 * reading. Eight hex characters is not a boundary against a preimage attack,
 * it is a guard against the row having moved, which is all this needs to be.
 */
const DIGEST_LENGTH = 8;

export function reviewDigest(text: string): string {
  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex")
    .slice(0, DIGEST_LENGTH);
}

/**
 * The same fingerprint, computed by Postgres over a review column.
 *
 * A fragment rather than a read, so the check and the write are one statement:
 * reading the text, hashing it in Node and updating afterwards would leave a
 * window for the author to edit in between, which is precisely the window the
 * digest exists to close. Shared with `reviewDigest` above so the two sides
 * cannot disagree on how many characters they compare.
 */
export function reviewDigestMatches(
  column: PgColumn,
  digest: string,
): SQL<unknown> {
  return sql`LEFT(ENCODE(SHA256(CONVERT_TO(${column}, 'UTF8')), 'hex'), ${DIGEST_LENGTH}) = ${digest}`;
}
