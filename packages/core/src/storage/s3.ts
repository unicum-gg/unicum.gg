import { createHash, createHmac } from "node:crypto";

/**
 * The little of S3 we actually use, signed by hand.
 *
 * Four operations against one bucket, so this is a signer rather than a client
 * library. `@aws-sdk/client-s3` would pull some fifty packages into a
 * dependency list this repo visibly curates, and it reaches for streaming
 * chunked signatures (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`) on uploads, which
 * is the one thing that misbehaves behind a proxy that may re-chunk a body.
 * Everything here hashes the payload up front instead, which is what a 1 MB
 * replay wants anyway.
 *
 * A wrong signature is not a subtle failure: the server answers 403 and names
 * the mismatch. That is why this is a reasonable thing to hand-write, where
 * hand-writing the encryption of a replay would not be.
 *
 * **Path style, always** (`/bucket/key`, not `bucket.host/key`). Garage serves
 * both, but virtual-host style needs a wildcard DNS entry and a wildcard
 * certificate per bucket, and we have neither. It also keeps the move to
 * another provider a change of four environment variables.
 */

/** Where the bucket lives and who may write to it. */
export type S3Target = {
  /** Origin only, no trailing slash: `http://garage-xyz:3900`. */
  endpoint: string;
  bucket: string;
  /** Garage calls its region `garage`; Scaleway would say `fr-par`. */
  region: string;
  keyId: string;
  secret: string;
};

/** What S3 said, with the body already read so nothing leaks a socket. */
export type S3Response = {
  status: number;
  ok: boolean;
  headers: Headers;
  body: Uint8Array;
};

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

const sha256 = (data: Uint8Array | string): string =>
  createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("hex");

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/**
 * One path segment, encoded the way S3 canonicalises it.
 *
 * `encodeURIComponent` leaves `!'()*` alone and S3 does not, so they are
 * finished off by hand. Our own keys are digits, slashes, dashes and dots, so
 * this never fires today; it is here because the day a key carries something
 * else, the failure would be a 403 nobody could read.
 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `/bucket/a/b/c`, each segment encoded, the slashes left as separators. */
function canonicalPath(bucket: string, key: string): string {
  const segments = key.split("/").map(encodeSegment);
  return `/${encodeSegment(bucket)}/${segments.join("/")}`;
}

/** `20260105T214301Z` and `20260105`, which is the only date format this uses. */
function stamps(now: Date): { amzDate: string; dateOnly: string } {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  return { amzDate, dateOnly: amzDate.slice(0, 8) };
}

/**
 * Sign one request and send it.
 *
 * The signed headers are the minimum S3 requires plus `content-type` when
 * there is one: host, the payload hash and the date. Anything a proxy adds
 * along the way (`cf-connecting-ip`, `x-forwarded-for`) is therefore outside
 * the signature and cannot break it, which is what makes this work through
 * Cloudflare at all.
 */
export async function s3Request(
  target: S3Target,
  method: "GET" | "PUT" | "HEAD" | "DELETE",
  key: string,
  options: { body?: Uint8Array; contentType?: string } = {},
): Promise<S3Response> {
  const url = new URL(target.endpoint);
  const path = canonicalPath(target.bucket, key);
  const { amzDate, dateOnly } = stamps(new Date());
  const payloadHash = sha256(options.body ?? new Uint8Array());

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (options.contentType) headers["content-type"] = options.contentType;

  // Sorted by name, lowercased, values trimmed: the canonical form is not a
  // style choice, the server rebuilds the exact same string to compare.
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method,
    path,
    "", // No query string on any of the four operations.
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateOnly}/${target.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = ["aws4_request", SERVICE, target.region, dateOnly].reduceRight(
    (key, part) => hmac(key, part),
    `AWS4${target.secret}` as Buffer | string,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  headers.authorization =
    `${ALGORITHM} Credential=${target.keyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // `host` is signed but NOT handed to fetch: it is a forbidden header name,
  // and whether undici ignores it or throws has moved between Node versions.
  // Fetch derives the identical value from the URL, so the signature still
  // matches what the server rebuilds, and through Traefik and Cloudflare the
  // original Host is what reaches Garage.
  const { host: _signedOnly, ...sent } = headers;

  const response = await fetch(`${url.origin}${path}`, {
    method,
    headers: sent,
    // A Uint8Array is sent as-is with a real Content-Length, which is what
    // keeps the payload hash honest end to end.
    body: options.body as BodyInit | undefined,
  });

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: new Uint8Array(await response.arrayBuffer()),
  };
}

/**
 * The error S3 returned, as a sentence worth logging.
 *
 * S3 errors are XML with a `<Code>` and a `<Message>`, and the code is the
 * part that tells a full bucket (`QuotaExceeded`) from a bad key
 * (`SignatureDoesNotMatch`) from a missing object (`NoSuchKey`). Parsing it
 * with a regex rather than an XML library because there are exactly two fields
 * and they are never nested.
 */
export function s3Error(response: S3Response): string {
  const text = Buffer.from(response.body).toString("utf8");
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1];
  if (!code) return `HTTP ${response.status}`;
  return message ? `${code}: ${message}` : code;
}
