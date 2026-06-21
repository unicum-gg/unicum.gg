// Verifies the Ed25519 signature Discord attaches to every interaction request.
// Discord rejects an application whose endpoint does not reject bad signatures
// with 401, so this gate is mandatory, not optional.
// Uses Web Crypto (Node 18+ / Edge both support Ed25519) so we add no deps.

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.length % 2 === 0 ? hex : "0" + hex;
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

let cachedKeyHex: string | null = null;
let cachedKey: CryptoKey | null = null;

async function importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
  if (cachedKey && cachedKeyHex === publicKeyHex) return cachedKey;
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(publicKeyHex),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  cachedKey = key;
  cachedKeyHex = publicKeyHex;
  return key;
}

/**
 * Validates the `X-Signature-Ed25519` / `X-Signature-Timestamp` header pair
 * against the raw request body. Returns false on any malformed input rather
 * than throwing, so the route can answer a clean 401.
 */
export async function verifyDiscordRequest(
  publicKeyHex: string,
  signatureHex: string | null,
  timestamp: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false;
  try {
    const key = await importPublicKey(publicKeyHex);
    const message = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signatureHex),
      message,
    );
  } catch {
    return false;
  }
}
