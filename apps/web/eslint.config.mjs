import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone CommonJS modules loaded outside the transpiled bundle (by the
    // Next server runtime and by PM2), so they legitimately use
    // `require`/`module.exports`.
    "config/cache-handler.js",
    "ecosystem.config.cjs",
  ]),
  // The OG image pipeline. These files are not rendered by a browser: satori
  // turns them into a PNG, and it supports `img` and nothing else, so the
  // `next/image` advice has nothing to point at here.
  {
    files: ["src/app/api/og/**/*.tsx", "src/components/og.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // The site is published in 36 languages behind a path prefix, and nothing
  // carries that prefix by hand: three wrappers add it. Importing Next's own
  // `Link` or `useRouter` silently drops it, which type-checks, renders, and
  // sends a French page's anchors to the English URL — what a crawler reads,
  // and an extra proxy round trip for a reader. It had been swapped everywhere
  // once and had crept back into ten files by the next review, so it is a rule
  // rather than a convention.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // The wrappers themselves, and the language menu, which is the one place
      // that must navigate WITHOUT the current locale being re-applied.
      "src/components/link.tsx",
      "src/hooks/use-router.ts",
      "src/hooks/use-pathname.ts",
      "src/components/locale-selector.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Import Link from `@/components/link`: it adds the locale prefix.",
            },
          ],
          patterns: [
            {
              group: ["next/navigation"],
              importNames: ["useRouter", "usePathname"],
              message:
                "Use `@/hooks/use-router` and `@/hooks/use-pathname`: one adds the locale prefix, the other strips it before you read the path.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
