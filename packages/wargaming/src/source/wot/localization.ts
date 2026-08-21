import { rawUrl, WotSrcBranch } from "./mirror";

const unquote = (line: string): string =>
  line
    .replace(/^"|"$/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

// WoT descriptions embed inline formatting placeholders the client substitutes
// at render time (`{colorTagOpen}+27.5%{colorTagClose}`, ...). We render plain
// text, so drop the markers and keep their content.
const stripTags = (s: string): string => s.replace(/\{[a-zA-Z_]+\}/g, "");

/**
 * Parse a gettext `.po` file into a `msgid -> msgstr` map. Handles the multi-line
 * form (`msgstr ""` followed by continuation `"..."` lines), so long strings
 * like perk / feature descriptions come through whole, not truncated to `""`.
 *
 * The header entry is dropped. Every `.po` opens with `msgid ""` whose `msgstr`
 * is the file's own metadata block (`Project-Id-Version: ...`), which is not a
 * translation of anything. Kept, it makes `get("")` return a long, truthy
 * string, and every caller here reaches this map through an optional key that
 * is `""` when the client XML omits the field. A `??` chain then reads the
 * header as a real translation and never falls back. That is exactly how ~185
 * vehicles per region (the ones whose short name equals their full name: IS-7,
 * T-34, Type 59, ...) ended up slugged from the metadata block.
 */
export function parsePo(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let id: string | null = null;
  let value = "";
  let field: "id" | "str" | null = null;
  const flush = () => {
    // `id !== ""` drops the header; see above.
    if (id !== null && id !== "") out.set(id, stripTags(value));
    id = null;
    value = "";
    field = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("msgid ")) {
      flush();
      id = unquote(line.slice(6).trim());
      field = "id";
    } else if (line.startsWith("msgstr ")) {
      value = unquote(line.slice(7).trim());
      field = "str";
    } else if (line.startsWith('"')) {
      // A continuation line of whichever field is open.
      if (field === "str") value += unquote(line);
      else if (field === "id") id = (id ?? "") + unquote(line);
    }
  }
  flush();
  return out;
}

// Each `.po` is a single shared file per client build, so fetch + parse it once
// per (branch, file) and reuse across every tank.
const cache = new Map<string, Promise<Map<string, string>>>();

/** A `.po` file's `msgid -> msgstr` map, fetched and parsed once (memoized).
 * Fails open to an empty map so a localization hiccup just drops the strings. */
export function loadPo(
  branch: WotSrcBranch,
  file: string,
  fetchText: (url: string) => Promise<string>,
): Promise<Map<string, string>> {
  const key = `${branch}:${file}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchText(
      rawUrl(branch, `sources/res/text/lc_messages/${file}.po`),
    )
      .then(parsePo)
      .catch(() => new Map<string, string>());
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Resolve a WoT localization ref of the form `#<file>:<key>` (e.g.
 * `#ussr_vehicles:_122mm_UOF-471`) to its localized string, or null when the
 * ref is malformed or the key is absent.
 */
export async function resolveRef(
  ref: string,
  branch: WotSrcBranch,
  fetchText: (url: string) => Promise<string>,
): Promise<string | null> {
  const m = /^#([^:]+):(.+)$/.exec(ref.trim());
  if (!m) return null;
  const po = await loadPo(branch, m[1], fetchText);
  return po.get(m[2]) ?? null;
}
