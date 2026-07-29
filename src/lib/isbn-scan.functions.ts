import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({
  image_base64: z.string().min(100).max(8_000_000),
  mime_type: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

const WebhookResponse = z.object({
  isbn: z.string().trim().min(8).max(20).optional().nullable(),
  title: z.string().trim().max(500).optional().nullable(),
  author: z.string().trim().max(500).optional().nullable(),
  language: z.string().trim().max(50).optional().nullable(),
}).passthrough();

type ScanResult =
  | { ok: true; isbn: string | null; title?: string | null; author?: string | null; language?: string | null }
  | { ok: false; code: "not_configured" | "webhook_error" | "bad_response"; message: string };

async function loadWebhook() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("isbn_webhook_url, isbn_webhook_auth_header")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function callWebhook(image_base64: string, mime_type: string): Promise<ScanResult> {
  const cfg = await loadWebhook();
  if (!cfg?.isbn_webhook_url) {
    return { ok: false, code: "not_configured", message: "ISBN scanning isn't set up yet." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.isbn_webhook_auth_header) headers["Authorization"] = cfg.isbn_webhook_auth_header;
    const res = await fetch(cfg.isbn_webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify({ image_base64, mime_type }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, code: "webhook_error", message: `Webhook returned ${res.status}` };
    }
    const json = await res.json().catch(() => null);
    const parsed = WebhookResponse.safeParse(json);
    if (!parsed.success) {
      return { ok: false, code: "bad_response", message: "Webhook returned unexpected data" };
    }
    return {
      ok: true,
      isbn: parsed.data.isbn ?? null,
      title: parsed.data.title ?? null,
      author: parsed.data.author ?? null,
      language: parsed.data.language ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      code: "webhook_error",
      message: e?.name === "AbortError" ? "Webhook timed out" : (e?.message ?? "Webhook call failed"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const scanIsbnFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScanInput.parse(data))
  .handler(async ({ data, context }): Promise<ScanResult> => {
    // Any signed-in staff member can scan; library scoping isn't required since
    // the call only relays an image to the platform-configured webhook.
    void context.userId;
    return callWebhook(data.image_base64, data.mime_type);
  });

export const getIsbnWebhookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ configured: boolean }> => {
    const cfg = await loadWebhook();
    return { configured: !!cfg?.isbn_webhook_url };
  });

const BOOK_SCAN_WEBHOOK_KEY = "book_scan_processing";

export type BookScanWebhookConfig = {
  id: string | null;
  url: string | null;
  is_active: boolean;
  has_auth: boolean;
  updated_at: string | null;
};

/** Loads book-scan webhook settings without exposing the auth header to the browser. */
export const getBookScanWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BookScanWebhookConfig | null> => {
    const { supabase } = context;
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) return null;

    const { data, error } = await supabase
      .from("webhook_configs")
      .select("id, url, is_active, updated_at, auth_header")
      .eq("key", BOOK_SCAN_WEBHOOK_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      return { id: null, url: null, is_active: false, has_auth: false, updated_at: null };
    }

    return {
      id: data.id,
      url: data.url,
      is_active: data.is_active,
      has_auth: !!(data.auth_header?.trim()),
      updated_at: data.updated_at,
    };
  });

/** Synthetic Supabase Database Webhook envelope for a book_scan_jobs INSERT. */
function buildBookScanTestPayload() {
  const now = new Date().toISOString();
  return {
    type: "INSERT",
    table: "book_scan_jobs",
    schema: "public",
    record: {
      id: "00000000-0000-4000-8000-000000000001",
      library_id: "00000000-0000-4000-8000-000000000002",
      storage_path: null,
      status: "pending",
      extracted_data: null,
      error_message: null,
      created_by: "00000000-0000-4000-8000-000000000003",
      created_at: now,
      updated_at: now,
      scan_method: "barcode",
      isbn: "9780143127741",
    },
    old_record: null,
  };
}

/** POSTs a realistic book_scan_jobs payload to the saved webhook URL (bypasses is_active). */
export const testBookScanWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Not authorized");

    const { data: config, error } = await supabase
      .from("webhook_configs")
      .select("url, auth_header")
      .eq("key", BOOK_SCAN_WEBHOOK_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const url = config?.url?.trim() ?? "";
    if (!url) throw new Error("No webhook URL saved yet. Save a URL first.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authHeader = config?.auth_header?.trim();
      if (authHeader) headers["Authorization"] = authHeader;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBookScanTestPayload()),
        signal: controller.signal,
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 4000) };
    } catch (e: any) {
      return {
        status: 0,
        body: e?.name === "AbortError" ? "Request timed out" : (e?.message ?? "Request failed"),
      };
    } finally {
      clearTimeout(timeout);
    }
  });
