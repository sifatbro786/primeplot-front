import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * On-demand revalidation webhook, called by the API (contract: API.md › Revalidation webhook):
 *   X-PrimePlot-Timestamp: <unix seconds>
 *   X-PrimePlot-Signature: sha256=<hex HMAC-SHA256(REVALIDATE_SECRET, "<timestamp>.<raw body>")>
 *   { "tags": ["projects", "project:<slug>", "org"] }
 * Signature is checked over the RAW body in constant time; a timestamp more than 5 minutes off
 * is a replay. Tags are expired at once (`expire: 0`): the next visitor gets fresh data, which
 * matters for unit availability.
 */
const MAX_SKEW_SEC = 300;
const MAX_BODY = 10_000;
const MAX_TAGS = 50;
const TAG_RE = /^(?:projects|org|site|project:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

const fail = (status, error) => Response.json({ ok: false, error }, { status });

function validSignature(secret, timestamp, raw, header) {
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(String(header ?? ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  if (secret.length < 32) return fail(503, "REVALIDATE_DISABLED");

  const timestamp = request.headers.get("x-primeplot-timestamp") ?? "";
  if (!/^\d{9,12}$/.test(timestamp)) return fail(401, "BAD_TIMESTAMP");
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_SKEW_SEC) return fail(401, "STALE_TIMESTAMP");

  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, "PAYLOAD_TOO_LARGE");
  if (!validSignature(secret, timestamp, raw, request.headers.get("x-primeplot-signature"))) {
    return fail(401, "BAD_SIGNATURE");
  }

  let tags;
  try {
    tags = JSON.parse(raw)?.tags;
  } catch {
    return fail(400, "INVALID_JSON");
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) return fail(400, "BAD_TAGS");
  if (!tags.every((t) => typeof t === "string" && t.length <= 200 && TAG_RE.test(t))) return fail(400, "BAD_TAGS");

  const unique = [...new Set(tags)];
  for (const tag of unique) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true, revalidated: unique });
}
