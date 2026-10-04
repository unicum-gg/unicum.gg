/**
 * How a press on a moderation card was resolved.
 *
 * One enum for every moderated queue, because the three outcomes are a property
 * of the mechanism rather than of what was reviewed: a durable Discord button
 * can land on a row somebody else already settled, or on prose the author has
 * since rewritten, and the bot puts very different words on the card for each.
 * Two copies with the same three members would eventually let a reply say
 * "already handled" for one queue and nothing at all for the other.
 */
export enum ReviewDecision {
  Settled = "settled",
  /** Unknown id, or somebody already pressed a button on it. */
  AlreadyReviewed = "already_reviewed",
  /** The row's text has changed since this card was posted, so the card is
   * about prose that no longer exists. A newer card carries the new text. */
  Stale = "stale",
}
