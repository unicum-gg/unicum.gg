# Locales

The site's interface text, one folder per language.

> **Only `en/` is written by hand.** The other 35 folders are generated from it by
> CI (`.github/workflows/translations.yml`) on every push that touches an English
> file. Editing them directly works until the next run, which rewrites each file
> from the English shape.

## Structure

A file's path from `<locale>/` **is** its namespace, and it mirrors the path of
the code that reads it:

```tree
locales/
├── en/
│   ├── components/
│   │   ├── footer.json            → src/components/footer/index.tsx
│   │   ├── nav-sections.json      → src/components/nav-sections.ts
│   │   └── home/
│   │       └── home-page.json     → src/components/home/home-page.tsx
│   └── app/
│       └── ...                    → src/app/[locale]/...
├── fr/ …                          generated
└── generated/                     per-locale modules, gitignored
```

`generated/` is not a locale: it holds one module per language importing the
files above, so the dictionaries are bundled rather than read from disk at
runtime (`output: "standalone"` ships only what the tracer sees). It is rewritten
by `scripts/generate-locales.ts` on `predev` / `prebuild` / `postinstall`.

## Reading a string

Server components take the language from their route params, never from
`headers()`: reading a header opts the page out of static rendering, and most of
this site is `force-static` behind the ISR cache.

```tsx
import { getTranslation } from "@/lib/translations.server";

export default async function Page({ params }) {
  const { locale } = await params;
  const { t } = await getTranslation("components/home/home-page", locale);
  return <h1>{t("community.heading")}</h1>;
}
```

Client components read it from the context the root layout installs, so nothing
has to be threaded down:

```tsx
"use client";
import { useTranslation } from "@/hooks/use-translation";

export function Footer() {
  const { t } = useTranslation("components/footer");
  return <p>{t("tagline")}</p>;
}
```

`Namespace` is generated from the English files, so a namespace that does not
exist is a compile error rather than a key rendered at a reader.

A sentence carrying a React node inside it goes through `Interpolate` rather than
being cut in two, so the word order stays the translator's to decide:

```tsx
<Interpolate
  template={t("top-players.day.description")}
  values={{ metric: <RatingMetricInlineSelect /> }}
/>
```

## Adding a string

1. Add the key to `en/<path>/<file>.json`. English only.
2. Read it with `t("<path>/<file>")` + the key.
3. Push. CI writes the other 35 languages and commits them.

`pnpm --filter @unicum.gg/web translate` does the same locally (needs
`OPENAI_API_KEY_TRANSLATIONS`, falling back to `OPENAI_API_KEY`), optionally for
one language: `... translate fr`.

It never overwrites a translation that is already there, which is what makes a
hand correction stick. When the model itself got a batch wrong (it does
occasionally translate a game term the prompt asked it to leave alone),
`... translate fr --force` re-translates what that locale already holds. Scope it
to the languages you name and read the diff.

## Conventions

Enforced by `pnpm --filter @unicum.gg/web test`, which is the only thing that
sees this tree: neither the type checker nor a reviewer reads 36 folders of
generated JSON.

- File names and key segments are lowercase or kebab-case ASCII: `footer.json`,
  `nav.home`, `quick-start.title`.
- Group with nesting, not with prefixes: `hero.title`, not `hero-title`.
- Keys are English identifiers describing the slot, not the sentence.
- Interpolate rather than concatenate: `"Ranked by {metric} over 24 hours."`
- No title case, and no em-dashes or semicolons, in any language.
- Never fall back in code (`t("x") || "Top"`): a fallback hides a missing key
  from the completeness check, which is what would have caught it.
## The game's words are not ours

Everything under `game/` is Wargaming's vocabulary, and it is translated under
different rules, because a mode already has a name in every language the game
ships in: a French player reads **Offensive**, never *Onslaught*. Leaving those
in English is what makes a page read as half-translated to the only people who
would notice.

Three sources, in order of authority:

1. **Wargaming's own API**, for `game/vehicle-classes`, `game/nations`,
   `game/crew-roles` and `game/mastery`. `pnpm --filter @unicum.gg/web vocabulary`
   fetches them per language and overwrites: never edit those four by hand, and
   the translator skips them for the twelve languages the game is published in.
2. **The English constants**, for `game/vocabulary`: the mode names, the marks,
   the map's points of interest. `en/game/vocabulary.json` is generated from the
   `*_LABEL` maps in `@unicum.gg/shared`, so the English side cannot drift from
   what the API and the Discord bot answer.
3. **The model**, for every other language of `game/vocabulary`, with a prompt
   that asks for the game's own wording rather than a translation, and that says
   plainly when there is none to find.

The twelve languages the game is published in are the ones Wargaming's API
accepts (`en fr de es pl cs tr ru vi th ko zh`), measured rather than assumed.
For the other fifteen there is no official term, so ours is the only one and the
model writes it like any other string.

**If a term is wrong, fix the file.** The generator never overwrites what a
locale already holds, so a correction survives every later run.
`... translate <locale> --force` is the way back if the model itself needs
redoing.

Product names stay in English everywhere: `Wargaming`, `World of Tanks`, `WN8`,
`WNX`, `unicum.gg`, and the names of tanks and maps.
