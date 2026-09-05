import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4, query-string form — presigned URLs.
 *
 * Written out rather than pulled from the AWS SDK, deliberately. The SDK brings
 * ten megabytes and several dozen transitive packages to produce what is, for
 * our purposes, two signed URLs; and this business is far likelier to end up on
 * Cloudflare R2 than on AWS, because R2 charges nothing for egress and this is
 * an app that serves video. The same signing works for S3, R2, Backblaze B2 and
 * MinIO.
 *
 * This is composing HMAC-SHA256 to a public specification, not inventing
 * cryptography — and the failure mode is fail-closed and loud: a wrong
 * signature is a 403, never a quietly weaker one. The key derivation below is
 * checked against AWS's own published vector in the security suite, so the part
 * that is easy to get subtly wrong is verified against an independent source.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";

/** RFC 3986. encodeURIComponent leaves !'()* alone; S3 does not. */
function uriEncode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Object keys may contain slashes, which stay as separators. */
function encodePath(key: string) {
  return key
    .split("/")
    .map((segment) => uriEncode(segment))
    .join("/");
}

const sha256Hex = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data, "utf8").digest();

function signingKey(
  secret: string,
  date: string,
  region: string,
  service: string,
) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /**
   * Set for anything that is not AWS. R2 and MinIO address buckets by path;
   * AWS uses a virtual host. Getting this wrong produces a signature over the
   * wrong canonical path, so it is derived from the endpoint rather than left
   * as a separate flag to forget.
   */
  endpoint?: string;
};

export type PresignOptions = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  key: string;
  expiresIn: number;
  /**
   * Signed as a header, which means the client is *required* to send exactly
   * this on the request. That is what stops a ticket issued for a photograph
   * being used to upload something else.
   */
  contentType?: string;
  /** Extra query parameters, e.g. response-content-disposition on a GET. */
  query?: Record<string, string>;
};

function hostAndPath(config: S3Config, key: string) {
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    return {
      host: url.host,
      origin: url.origin,
      path: `/${config.bucket}/${encodePath(key)}`,
    };
  }
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  return { host, origin: `https://${host}`, path: `/${encodePath(key)}` };
}

/**
 * A URL that carries its own authorisation, valid for `expiresIn` seconds.
 *
 * Note what a presigned PUT cannot do: enforce a maximum size. That needs a
 * POST policy with conditions. The size is therefore checked after the fact —
 * completeUpload reads the object's real length from storage and deletes it if
 * it exceeds the ticket. Anyone reading this and adding a size claim to the URL
 * should know it would not be enforced.
 */
export function presign(
  config: S3Config,
  options: PresignOptions,
  now = new Date(),
): string {
  const { host, origin, path } = hostAndPath(config, options.key);

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host };
  if (options.contentType) headers["content-type"] = options.contentType;

  const signedHeaders = Object.keys(headers).sort().join(";");

  const params: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(options.expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
    ...(config.sessionToken
      ? { "X-Amz-Security-Token": config.sessionToken }
      : {}),
    ...(options.query ?? {}),
  };

  // Canonical query: sorted by encoded key, both sides encoded.
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join("&");

  const canonicalHeaders =
    Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k].trim()}\n`)
      .join("") ;

  const canonicalRequest = [
    options.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    // Presigned URLs do not sign the body — the whole point is that the body
    // is sent later, by someone else.
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(config.secretAccessKey, dateStamp, config.region, "s3"),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Exported for the suite, which checks it against AWS's published vector. */
export const __testing = { signingKey, uriEncode, encodePath };
