// Relays the fixed Supabase Database Webhook on book_scan_jobs INSERT to the
// N8N URL stored in webhook_configs, so the destination stays configurable at
// runtime without touching the webhook definition.
//
// Invoked server-to-server only (Supabase -> here), never from a browser, so
// there is no CORS preflight handling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const RELAY_SECRET = Deno.env.get("SCAN_WEBHOOK_RELAY_SECRET");

const WEBHOOK_CONFIG_KEY = "book_scan_processing";
const DOWNSTREAM_TIMEOUT_MS = 10_000;
const LOG_PREFIX = "[forward-scan-webhook]";

/**
 * The platform injects the legacy service_role key, but projects without legacy
 * keys only get the newer SUPABASE_SECRET_KEYS dictionary.
 */
function serviceRoleKey(): string | undefined {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  } catch {
    return undefined;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Compares without leaking the secret's contents through timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  if (!RELAY_SECRET) {
    console.error(`${LOG_PREFIX} SCAN_WEBHOOK_RELAY_SECRET is not set; refusing all requests`);
    return json(500, { error: "not_configured" });
  }

  const provided = req.headers.get("X-Webhook-Secret");
  if (!provided || !secretMatches(provided, RELAY_SECRET)) {
    console.error(`${LOG_PREFIX} rejected request: missing or invalid X-Webhook-Secret`);
    return json(401, { error: "unauthorized" });
  }

  // Read as text so the exact bytes Supabase sent can be forwarded downstream.
  const rawBody = await req.text();
  let payload: { record?: { id?: string } } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error(`${LOG_PREFIX} rejected request: body is not valid JSON`);
    return json(400, { error: "invalid_json" });
  }
  const jobId = payload?.record?.id ?? "unknown";

  const secretKey = serviceRoleKey();
  if (!SUPABASE_URL || !secretKey) {
    console.error(`${LOG_PREFIX} job=${jobId} missing SUPABASE_URL or service role key`);
    return json(500, { error: "not_configured" });
  }

  const supabase = createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await supabase
    .from("webhook_configs")
    .select("url, auth_header, is_active")
    .eq("key", WEBHOOK_CONFIG_KEY)
    .limit(1)
    .maybeSingle();

  if (configError) {
    // A failed lookup is not the same as "not configured" — it may be
    // transient, so let the Database Webhook retry.
    console.error(
      `${LOG_PREFIX} job=${jobId} could not read ${WEBHOOK_CONFIG_KEY} config: ${configError.message}`,
    );
    return json(502, { forwarded: false, reason: "config_lookup_failed" });
  }

  const url = config?.url?.trim() ?? "";
  if (!config || !config.is_active || !url) {
    console.log(
      `${LOG_PREFIX} job=${jobId} ${WEBHOOK_CONFIG_KEY} webhook not configured or inactive, skipping forward`,
    );
    return json(200, { forwarded: false, reason: "not_configured" });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeader = config.auth_header?.trim();
  if (authHeader) headers["Authorization"] = authHeader;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `${LOG_PREFIX} job=${jobId} forward failed: downstream returned ${res.status} ${res.statusText} body=${text.slice(0, 2000)}`,
      );
      return json(502, { forwarded: false, reason: "downstream_error", status: res.status });
    }

    console.log(`${LOG_PREFIX} job=${jobId} forwarded successfully (downstream ${res.status})`);
    return json(200, { forwarded: true });
  } catch (e) {
    const timedOut = (e as { name?: string } | undefined)?.name === "AbortError";
    const detail = timedOut
      ? `timed out after ${DOWNSTREAM_TIMEOUT_MS}ms`
      : ((e as { message?: string } | undefined)?.message ?? "unknown error");
    console.error(`${LOG_PREFIX} job=${jobId} forward failed: ${detail}`);
    return json(502, { forwarded: false, reason: timedOut ? "timeout" : "network_error" });
  } finally {
    clearTimeout(timeout);
  }
});
