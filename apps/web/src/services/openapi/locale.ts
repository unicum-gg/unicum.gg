import * as z from "zod";
import { DEFAULT_LOCALE } from "@/lib/translations";

/**
 * The parameter a caller names the language of the ANSWER with.
 *
 * `language`, the same word the leaderboards use for their own filter, and that
 * is a deliberate choice rather than an oversight: one word across the API is
 * easier to remember than two, and the two live on endpoints that have nothing
 * else in common, so nobody meets both in one call. What each one does is in
 * its description.
 *
 * Not an enum, deliberately. The set of languages a given catalogue exists in
 * is not ours to publish per endpoint (Wargaming decides it for the medals, the
 * translation budget decides it for the glossary), and every one of these falls
 * back to English rather than rejecting, so an unknown value degrades instead
 * of 400ing. `Content-Language` on the response is what tells the caller which
 * one they actually got.
 *
 * `.optional()` is applied at the USE SITE rather than baked in here, because
 * next-openapi-gen reads the object off the AST: a field whose optionality was
 * folded into an imported const comes out `required: true` in the spec, which
 * is how six endpoints ended up documenting an optional parameter as mandatory.
 */
export const answerLanguageField = z.string().meta({
  description:
    "Language to write the answer in (an interface locale, e.g. `fr`). Falls back to English for a language this catalogue has not been translated into; the response's `Content-Language` names the one actually served.",
  example: "fr",
});

/** The language a request asked its answer to be written in. */
export function requestedLanguage(req: Request): string | undefined {
  return new URL(req.url).searchParams.get("language") ?? undefined;
}

/**
 * Say which language the body is actually in.
 *
 * The one served, never the one asked for: every catalogue here falls back to
 * English, so echoing the request would tell a French caller they got French
 * when the answer is English. That is worse than saying nothing, because a
 * cache and a client both believe it.
 */
export function contentLanguage(
  served: string | undefined,
  init?: ResponseInit,
): ResponseInit {
  return {
    ...init,
    headers: {
      ...init?.headers,
      "content-language": served ?? DEFAULT_LOCALE,
    },
  };
}
