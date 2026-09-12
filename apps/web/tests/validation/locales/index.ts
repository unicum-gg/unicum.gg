import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, LOCALES } from "../../../src/lib/translations";
import { boundaryTests } from "./boundary";
import { articlesTests } from "./articles";
import { copyTests } from "./copy";
import { directiveTests } from "./directive";
import { holesTests } from "./holes";
import { completenessTests } from "./completeness";
import { namingTests } from "./naming";
import { qualityTests } from "./quality";
import { structureTests } from "./structure";
import { usageTests } from "./usage";
import { vocabularyTests } from "./vocabulary";

export const LOCALES_DIR = path.join(__dirname, "../../../src/locales");
export const SRC_DIR = path.join(__dirname, "../../../src");
export const SOURCE_LOCALE = DEFAULT_LOCALE;

/** The languages this suite checks against English: every one but English. */
export const targetLocales = LOCALES.filter((l) => l !== SOURCE_LOCALE);

/** The per-locale modules the bundler reads. Generated, not authored, so the
 * folder is not a locale and every check has to skip it. */
export const GENERATED_DIR = "generated";

export function jsonFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const relative = path.join(base, entry);
    if (fs.statSync(full).isDirectory()) out.push(...jsonFiles(full, relative));
    else if (entry.endsWith(".json")) out.push(relative);
  }
  return out.sort();
}

/** Every leaf key, dotted. */
export function keysOf(value: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "object" && child !== null && !Array.isArray(child))
      out.push(...keysOf(child as Record<string, unknown>, full));
    else out.push(full);
  }
  return out;
}

export function readLocale(locale: string, file: string) {
  return JSON.parse(
    fs.readFileSync(path.join(LOCALES_DIR, locale, file), "utf-8"),
  ) as Record<string, unknown>;
}

export function localesTests() {
  structureTests();
  completenessTests();
  namingTests();
  qualityTests();
  usageTests();
  boundaryTests();
  copyTests();
  holesTests();
  directiveTests();
  articlesTests();
  vocabularyTests();
}
