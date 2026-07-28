import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import type { InviteTemplateKey } from '@/lib/email-templates/_meta'
import { TEMPLATE_META } from '@/lib/email-templates/_meta'

export interface SendInviteEmailArgs {
  templateName: InviteTemplateKey
  recipientEmail: string
  idempotencyKey: string
  /** If provided, per-library overrides are merged on top of platform defaults. */
  libraryId?: string | null
  /** Values used to substitute {{tokens}} in the template. */
  vars: Record<string, string | undefined>
}

interface EffectiveSettings {
  accent_color?: string
  logo_url?: string | null
  footer_text?: string
  site_name?: string
  invite_expiry_hours?: number
  template_overrides?: Record<string, Partial<Record<keyof typeof TEMPLATE_META[InviteTemplateKey]['defaults'], string>>>
  library_template_overrides?: Record<string, any>
}

async function fetchEffectiveSettings(libraryId?: string | null): Promise<EffectiveSettings> {
  const { data, error } = await supabase.rpc('get_effective_email_settings', {
    p_library_id: libraryId ?? undefined,
  } as any)
  if (error) throw error
  return (data ?? {}) as EffectiveSettings
}

/**
 * Sends a branded invitation email through the transactional queue.
 * Silently returns { skipped: true } if the send route rejects — the invite
 * link is always still shown in the UI as a manual-share fallback.
 */
export async function sendInviteEmail(args: SendInviteEmailArgs) {
  const { templateName, recipientEmail, idempotencyKey, libraryId, vars } = args

  const settings = await fetchEffectiveSettings(libraryId)
  const platformOverrides = settings.template_overrides?.[templateName] ?? {}
  const libraryOverrides = settings.library_template_overrides?.[templateName] ?? {}
  const contentOverrides = { ...platformOverrides, ...libraryOverrides }

  const templateData = {
    ...vars,
    siteName: vars.siteName ?? settings.site_name,
    accentColor: settings.accent_color,
    logoUrl: settings.logo_url ?? undefined,
    footerText: settings.footer_text,
    ...contentOverrides,
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { skipped: true as const, reason: 'no_session' }
  }

  try {
    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail,
        idempotencyKey,
        templateData,
      }),
    })

    const raw = await res.text()
    let json: any = undefined
    try {
      json = JSON.parse(raw)
    } catch {
      // Not JSON: the request never reached our server route. Either the app was
      // deployed without server handlers, or a platform layer (e.g. Vercel
      // deployment protection) answered with an HTML page first.
    }

    if (!res.ok) {
      const detail =
        json?.protection || /Protected deployment/i.test(raw)
          ? 'the deployment is protected, so the request never reached the server route'
          : json === undefined
            ? `the send route returned ${res.status} with a non-JSON body`
            : (json.error?.message ?? json.error ?? `HTTP ${res.status}`)
      console.warn('Invite email send failed', { status: res.status, detail, body: raw.slice(0, 500) })
      return { skipped: true as const, reason: 'send_failed', status: res.status, detail: String(detail) }
    }

    if (json === undefined) {
      console.warn('Invite email send got a non-JSON success response', { body: raw.slice(0, 500) })
      return {
        skipped: true as const,
        reason: 'send_route_missing',
        status: res.status,
        detail: 'the send route is not served by this deployment',
      }
    }

    if (json.success === false) {
      return { skipped: true as const, reason: json.reason ?? 'rejected', status: res.status, detail: String(json.reason ?? 'rejected') }
    }

    return { sent: true as const, ...json }
  } catch (err) {
    console.warn('Invite email send crashed', err)
    const detail = err instanceof Error ? err.message : 'network error'
    return { skipped: true as const, reason: 'network_error', detail }
  }
}

export type SendInviteResult = Awaited<ReturnType<typeof sendInviteEmail>>

/**
 * Surfaces a failed background send instead of dropping it. The invitation row
 * already exists at this point, so this is a warning, not an error: the copyable
 * link in the UI remains a working fallback.
 */
export function reportInviteEmailOutcome(pending: Promise<SendInviteResult>) {
  void pending
    .then((res) => {
      if ('sent' in res) return
      const detail = 'detail' in res && res.detail ? res.detail : res.reason
      toast.warning(`Invitation saved, but the email wasn't sent: ${detail}. Share the link manually.`)
    })
    .catch((err) => {
      console.warn('Invite email send threw', err)
      const detail = err instanceof Error ? err.message : 'unknown error'
      toast.warning(`Invitation saved, but the email wasn't sent: ${detail}. Share the link manually.`)
    })
}

export function expiresInLabel(hours: number | undefined): string {
  const h = hours ?? 336
  if (h % 24 === 0) {
    const d = h / 24
    return `${d} day${d === 1 ? '' : 's'}`
  }
  return `${h} hour${h === 1 ? '' : 's'}`
}
