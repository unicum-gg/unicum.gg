/**
 * Read an NDJSON stream, invoking `onChunk` for each complete line as it lands.
 * The search endpoints emit a `local` (DB) chunk first, then a `remote` (WG)
 * chunk, so results paint progressively instead of blocking on the WG call.
 */
export async function readNdjson<T>(
  res: Response,
  onChunk: (chunk: T) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onChunk(JSON.parse(line) as T);
      newline = buffer.indexOf("\n");
    }
  }
}
