import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import ts from "typescript";

/**
 * No English left bare in the JSX.
 *
 * The other checks read the dictionary tree, so they can only see a string that
 * was keyed. This one reads the COMPONENTS, and catches the opposite mistake: a
 * heading, a label or a sentence written straight into the markup, which no
 * amount of translating the tree will ever reach. That is what 294 of them were
 * doing when this was written, across 105 files, and nothing failed.
 *
 * Two areas are English on purpose and excluded by path: the API reference
 * under `app/docs`, and the OpenGraph images under `app/api/og`, which are
 * pictures rendered per share rather than pages a reader browses.
 */
export const EXCLUDED = ["/app/api/og/", "/app/docs/"];

/** Props whose value a reader sees. */
const COPY_PROPS = new Set([
  "title",
  "label",
  "placeholder",
  "alt",
  "aria-label",
  "emptyText",
  "description",
  "heading",
  "tip",
  "hint",
  "caption",
  "text",
  "message",
]);

/**
 * Whether a string is copy rather than a class name, a slug or punctuation.
 *
 * Deliberately loose on the side of NOT flagging: a false positive here is a
 * developer arguing with a test, and the cases this misses are found by reading
 * the page, which is how the first 294 were found anyway.
 */
function looksLikeCopy(value: string, inMarkup = false): boolean {
  const s = value.trim();
  if (!s || s.length > 300) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  // A bare HTML entity is punctuation: "&bull;", "&mdash;", "&deg;".
  if (/^(&[a-z]+;\s*)+$/.test(s)) return false;
  // A lone lowercase token is a slug or a class name in an attribute, and
  // prose between two tags: "{n} buffed" is a word a reader reads, and the
  // rule below was hiding every one of them.
  if (/^[a-z0-9-]+$/.test(s) && !s.includes(" ") && !inMarkup) return false;
  if (/[/\\]|https?:|^#|^@|\.(png|svg|json|md)$/.test(s)) return false;
  if (/^[A-Z][A-Za-z]*$/.test(s) && s.length <= 3) return false;
  if (s.split(/\s+/).length === 1 && s.length < 4) return false;
  return /[a-z]{3}/.test(s);
}

/** Every `.tsx` under a directory, the way the sibling checks walk the tree. */
export function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...componentFiles(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

export function bareCopy(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const src = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const at = (n: ts.Node) =>
    src.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  /**
   * Every English string an expression can hand to the page.
   *
   * Not only a bare literal: `{fav ? "Remove from favorites" : "Add to
   * favorites"}` is a ternary and `` title={`Have you played the ${tank}?`} ``
   * is a template, and both reached a reader untouched while this test passed.
   * A template's fixed parts are what matters; its holes are values.
   */
  const literalsIn = (node: ts.Node): string[] => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return [node.text];
    if (ts.isTemplateExpression(node))
      return [
        [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(
          " ",
        ),
      ];
    if (ts.isConditionalExpression(node))
      return [...literalsIn(node.whenTrue), ...literalsIn(node.whenFalse)];
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    )
      return [...literalsIn(node.left), ...literalsIn(node.right)];
    if (ts.isParenthesizedExpression(node)) return literalsIn(node.expression);
    return [];
  };

  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const text = n.getFullText().replace(/\s+/g, " ").trim();
      if (looksLikeCopy(text, true)) found.push(`${at(n)}: ${text.slice(0, 60)}`);
    }
    // `{...}` as an element's child.
    if (
      ts.isJsxExpression(n) &&
      n.expression &&
      n.parent &&
      (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
    )
      for (const text of literalsIn(n.expression))
        if (looksLikeCopy(text, true))
          found.push(`${at(n)}: {${text.slice(0, 55)}}`);
    if (ts.isJsxAttribute(n) && n.initializer && COPY_PROPS.has(n.name.getText())) {
      const init = n.initializer;
      const values = ts.isStringLiteral(init)
        ? [init.text]
        : ts.isJsxExpression(init) && init.expression
          ? literalsIn(init.expression)
          : [];
      for (const value of values)
        if (looksLikeCopy(value))
          found.push(`${at(n)}: ${n.name.getText()}="${value.slice(0, 50)}"`);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return found;
}

export function copyTests() {
  describe("Locales copy", () => {
    test("no English written straight into the markup", () => {
      const offenders: string[] = [];
      for (const file of componentFiles("src").sort()) {
        if (EXCLUDED.some((part) => file.includes(part))) continue;
        for (const hit of bareCopy(file)) offenders.push(`${file}:${hit}`);
      }
      assert.deepStrictEqual(
        offenders,
        [],
        "These strings are written into the markup, so no amount of translating the dictionary reaches them. Key them and read them through `t()`.",
      );
    });
  });
}
