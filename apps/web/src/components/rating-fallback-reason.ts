/**
 * Why a surface cannot show PR or WTR.
 *
 * In a module of its own rather than beside `RatingFallbackNote`: that one is a
 * `"use client"` module, which exports client REFERENCES, so a server component
 * importing the enum from it is handed undefined for every member.
 */
export enum RatingFallbackReason {
  /** It rates one vehicle, and Wargaming's ratings exist per account only. */
  Vehicle = "vehicle",
  /** It rates a window of time, and a career figure has no value over one. */
  Window = "window",
  /** It rates a single battle, which is a window of one. */
  Battle = "battle",
}
