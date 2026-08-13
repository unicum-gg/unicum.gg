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
    // Standalone CommonJS module loaded by the Next server runtime (outside the
    // transpiled bundle), so it legitimately uses `require`/`module.exports`.
    "config/cache-handler.js",
  ]),
  // The OG image pipeline. These files are not rendered by a browser: satori
  // turns them into a PNG, and it supports `img` and nothing else, so the
  // `next/image` advice has nothing to point at here.
  {
    files: ["src/app/api/og/**/*.tsx", "src/components/og.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
