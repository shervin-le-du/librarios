import * as React from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Monitor, Smartphone, RotateCcw } from 'lucide-react'
import { render as renderEmail } from '@react-email/render'
import { ColorPickerCard } from '@/components/ColorPickerCard'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { COLOR_ACCENT_PRESETS } from '@/lib/branding'
import { TEMPLATE_META, type InviteTemplateKey } from '@/lib/email-templates/_meta'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { substitute } from '@/lib/email-templates/_shared'
import { expiresInLabel } from '@/lib/email/send-invite'


const ACCENT_DEFAULT = '#2563eb'

interface EmailSettings {
  accent_color?: string
  logo_url?: string | null
  footer_text?: string
  site_name?: string
  invite_expiry_hours?: number
  template_overrides?: Record<string, Record<string, string>>
  library_template_overrides?: Record<string, Record<string, string>>
  library_id?: string
  library_name?: string
}

export interface EmailSettingsEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateKey: InviteTemplateKey
  scope: 'platform' | 'library'
  libraryId?: string | null
  title?: string
}

export function EmailSettingsEditor({
  open,
  onOpenChange,
  templateKey,
  scope,
  libraryId,
  title,
}: EmailSettingsEditorProps) {
  const qc = useQueryClient()
  const meta = TEMPLATE_META[templateKey]

  const settingsQuery = useQuery({
    queryKey: ['email-settings', scope, libraryId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_effective_email_settings' as any, {
        p_library_id: scope === 'library' ? libraryId : null,
      })
      if (error) throw error
      return (data ?? {}) as EmailSettings
    },
    enabled: open,
  })

  const s = settingsQuery.data ?? {}
  const platformOverride = s.template_overrides?.[templateKey] ?? {}
  const libraryOverride = s.library_template_overrides?.[templateKey] ?? {}
  const inherited = scope === 'library' ? { ...meta.defaults, ...platformOverride } : meta.defaults
  const effectiveContent = { ...inherited, ...(scope === 'library' ? libraryOverride : platformOverride) }

  // ---- Local edit state ----
  const [accent, setAccent] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [footerText, setFooterText] = useState<string>('')
  const [siteName, setSiteName] = useState<string>('')
  const [expiryHours, setExpiryHours] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [heading, setHeading] = useState<string>('')
  const [intro, setIntro] = useState<string>('')
  const [body, setBody] = useState<string>('')
  const [buttonLabel, setButtonLabel] = useState<string>('')
  const [expiryNote, setExpiryNote] = useState<string>('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const focusRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open || settingsQuery.isLoading) return
    // Reset controls from server state each time the sheet opens
    setAccent(s.accent_color ?? '')
    setLogoUrl(s.logo_url ?? '')
    setFooterText(s.footer_text ?? '')
    setSiteName(s.site_name ?? '')
    setExpiryHours(String(s.invite_expiry_hours ?? ''))
    const src = scope === 'library' ? libraryOverride : platformOverride
    setSubject(src.subject ?? '')
    setHeading(src.heading ?? '')
    setIntro(src.intro ?? '')
    setBody(src.body ?? '')
    setButtonLabel(src.buttonLabel ?? '')
    setExpiryNote(src.expiryNote ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settingsQuery.isLoading])

  const previewVars = useMemo(() => ({
    recipientName: 'Alex',
    inviterName: 'Ada Lovelace',
    libraryName: s.library_name ?? 'Riverside Public Library',
    role: 'librarian',
    acceptUrl: 'https://example.com/accept-invite?token=preview',
    expiresIn: expiresInLabel(Number(expiryHours) || s.invite_expiry_hours),
    siteName: siteName || s.site_name || 'Librarios',
  }), [s.library_name, s.site_name, siteName, expiryHours, s.invite_expiry_hours])

  const Template = TEMPLATES[templateKey].component

  const previewProps = {
    ...previewVars,
    accentColor: accent || s.accent_color,
    logoUrl: logoUrl || s.logo_url || undefined,
    footerText: footerText || s.footer_text,
    subject: subject || inherited.subject,
    heading: heading || inherited.heading,
    intro: intro || inherited.intro,
    body: body || inherited.body,
    buttonLabel: buttonLabel || inherited.buttonLabel,
    expiryNote: expiryNote || inherited.expiryNote,
  }

  const save = useMutation({
    mutationFn: async () => {
      const contentPatch: Record<string, string> = {}
      const setIfChanged = (key: string, value: string, base: string) => {
        if (value && value !== base) contentPatch[key] = value
      }
      setIfChanged('subject', subject, inherited.subject)
      setIfChanged('heading', heading, inherited.heading)
      setIfChanged('intro', intro, inherited.intro)
      setIfChanged('body', body, inherited.body)
      setIfChanged('buttonLabel', buttonLabel, inherited.buttonLabel)
      setIfChanged('expiryNote', expiryNote, inherited.expiryNote)

      if (scope === 'platform') {
        const nextTemplateOverrides = { ...(s.template_overrides ?? {}) }
        if (Object.keys(contentPatch).length === 0) {
          delete nextTemplateOverrides[templateKey]
        } else {
          nextTemplateOverrides[templateKey] = contentPatch
        }
        const patch: Record<string, unknown> = {
          template_overrides: nextTemplateOverrides,
        }
        if (accent) patch.accent_color = accent
        patch.logo_url = logoUrl
        if (footerText) patch.footer_text = footerText
        if (siteName) patch.site_name = siteName
        if (expiryHours) patch.invite_expiry_hours = Number(expiryHours)
        const { error } = await supabase.rpc('patch_platform_email_settings' as any, { p_patch: patch })
        if (error) throw error
      } else {
        if (!libraryId) throw new Error('Missing library id')
        const nextTemplateOverrides = { ...(s.library_template_overrides ?? {}) }
        if (Object.keys(contentPatch).length === 0) {
          delete nextTemplateOverrides[templateKey]
        } else {
          nextTemplateOverrides[templateKey] = contentPatch
        }
        const patch: Record<string, unknown> = {
          template_overrides: nextTemplateOverrides,
        }
        patch.accent_color = accent
        patch.logo_url = logoUrl
        patch.footer_text = footerText
        const { error } = await supabase.rpc('patch_library_email_settings' as any, {
          p_library_id: libraryId, p_patch: patch,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-settings'] })
      toast.success('Email settings saved')
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to save'),
  })

  const resetContent = () => {
    setSubject(inherited.subject)
    setHeading(inherited.heading)
    setIntro(inherited.intro)
    setBody(inherited.body)
    setButtonLabel(inherited.buttonLabel)
    setExpiryNote(inherited.expiryNote)
  }

  function insertToken(setter: React.Dispatch<React.SetStateAction<string>>, current: string) {
    return (token: string) => {
      const el = focusRef.current
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const start = el.selectionStart ?? current.length
        const end = el.selectionEnd ?? current.length
        const next = current.slice(0, start) + `{{${token}}}` + current.slice(end)
        setter(next)
        requestAnimationFrame(() => {
          el.focus()
          const pos = start + token.length + 4
          try { (el as any).setSelectionRange(pos, pos) } catch { /* noop */ }
        })
      } else {
        setter(current + `{{${token}}}`)
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{title ?? `Configure ${meta.label.toLowerCase()}`}</SheetTitle>
          <SheetDescription>
            {scope === 'platform'
              ? 'Platform defaults apply to every library unless the library overrides them.'
              : 'Library overrides only apply to this library. Empty fields inherit from platform defaults.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(360px,440px)_1fr]">
          {/* Editor */}
          <div className="border-r overflow-y-auto p-6">
            <Tabs defaultValue="branding" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
              </TabsList>

              <TabsContent value="branding" className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label>Accent color</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="size-9 shrink-0 rounded-md border border-input"
                          style={{ backgroundColor: accent || s.accent_color || ACCENT_DEFAULT }}
                          aria-label="Pick accent color"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-[340px] p-0 border-none bg-transparent shadow-none" align="start">
                        <ColorPickerCard
                          label="Accent color"
                          color={accent || s.accent_color || ACCENT_DEFAULT}
                          presets={COLOR_ACCENT_PRESETS}
                          onChange={setAccent}
                          defaultColor={s.accent_color ?? ACCENT_DEFAULT}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      placeholder={s.accent_color ?? ACCENT_DEFAULT}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo-url">Logo URL</Label>
                  <Input id="logo-url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder={s.logo_url ?? 'https://…/logo.png'} />
                  <p className="text-xs text-muted-foreground">Paste a public image URL. Recommended height: 40px.</p>
                </div>

                {scope === 'platform' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="site-name">Site name</Label>
                      <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)}
                        placeholder={s.site_name ?? 'Librarios'} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry-hours">Invitation expiry (hours)</Label>
                      <Input id="expiry-hours" type="number" min={1} max={8760} value={expiryHours}
                        onChange={(e) => setExpiryHours(e.target.value)}
                        placeholder={String(s.invite_expiry_hours ?? 336)} />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="footer-text">Footer text</Label>
                  <Textarea id="footer-text" rows={3} value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder={s.footer_text ?? ''} />
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-5 mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Insert variables with the chips. Leave a field blank to use the {scope === 'library' ? 'platform default' : 'built-in default'}.
                  </div>
                  <Button size="sm" variant="ghost" onClick={resetContent}>
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                </div>

                <VarChips variables={meta.variables}
                  onInsert={(t) => {
                    const el = focusRef.current
                    if (!el) return
                    const target = el.id
                    if (target === 'f-subject') insertToken(setSubject, subject)(t)
                    else if (target === 'f-heading') insertToken(setHeading, heading)(t)
                    else if (target === 'f-intro') insertToken(setIntro, intro)(t)
                    else if (target === 'f-body') insertToken(setBody, body)(t)
                    else if (target === 'f-button') insertToken(setButtonLabel, buttonLabel)(t)
                    else if (target === 'f-expiry') insertToken(setExpiryNote, expiryNote)(t)
                  }}
                />

                <FieldRow label="Subject">
                  <Input id="f-subject" value={subject}
                    onFocus={(e) => { focusRef.current = e.currentTarget }}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={inherited.subject} />
                </FieldRow>
                <FieldRow label="Heading">
                  <Input id="f-heading" value={heading}
                    onFocus={(e) => { focusRef.current = e.currentTarget }}
                    onChange={(e) => setHeading(e.target.value)}
                    placeholder={inherited.heading} />
                </FieldRow>
                <FieldRow label="Greeting">
                  <Input id="f-intro" value={intro}
                    onFocus={(e) => { focusRef.current = e.currentTarget }}
                    onChange={(e) => setIntro(e.target.value)}
                    placeholder={inherited.intro} />
                </FieldRow>
                <FieldRow label="Body">
                  <Textarea id="f-body" rows={6} value={body}
                    onFocus={(e) => { focusRef.current = e.currentTarget as any }}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={inherited.body} />
                </FieldRow>
                <FieldRow label="Button label">
                  <Input id="f-button" value={buttonLabel}
                    onFocus={(e) => { focusRef.current = e.currentTarget }}
                    onChange={(e) => setButtonLabel(e.target.value)}
                    placeholder={inherited.buttonLabel} />
                </FieldRow>
                <FieldRow label="Expiry note">
                  <Input id="f-expiry" value={expiryNote}
                    onFocus={(e) => { focusRef.current = e.currentTarget }}
                    onChange={(e) => setExpiryNote(e.target.value)}
                    placeholder={inherited.expiryNote} />
                </FieldRow>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview */}
          <div className="bg-muted/30 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium">Preview</div>
                <div className="text-xs text-muted-foreground">
                  Subject: <span className="font-medium text-foreground">{substitute(subject || inherited.subject, previewVars)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-md bg-background border p-1">
                <Button size="sm" variant={device === 'desktop' ? 'default' : 'ghost'} onClick={() => setDevice('desktop')}>
                  <Monitor className="size-3.5" />
                </Button>
                <Button size="sm" variant={device === 'mobile' ? 'default' : 'ghost'} onClick={() => setDevice('mobile')}>
                  <Smartphone className="size-3.5" />
                </Button>
              </div>
            </div>
            <Card className="p-0 overflow-hidden mx-auto" style={{ maxWidth: device === 'mobile' ? 380 : '100%' }}>
              <EmailPreviewFrame Template={Template} props={previewProps} device={device} />
            </Card>

          </div>
        </div>

        <SheetFooter className="p-4 border-t flex-row justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {scope === 'library' && s.library_name && (
              <Badge variant="outline">Overrides for {s.library_name}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function EmailPreviewFrame({
  Template,
  props,
  device,
}: {
  Template: React.ComponentType<any>
  props: Record<string, any>
  device: 'desktop' | 'mobile'
}) {
  const [html, setHtml] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const out = await renderEmail(React.createElement(Template, props))
        if (!cancelled) setHtml(out)
      } catch (e) {
        if (!cancelled) setHtml(`<pre style="padding:16px;color:#b91c1c">Preview failed: ${(e as Error).message}</pre>`)
      }
    })()
    return () => { cancelled = true }
  }, [Template, props])

  return (
    <iframe
      title="Email preview"
      srcDoc={html}
      sandbox=""
      className="w-full bg-white"
      style={{ height: device === 'mobile' ? 640 : 780, border: 0, display: 'block' }}
    />
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function VarChips({ variables, onInsert }: {
  variables: Array<{ token: string; label: string }>
  onInsert: (token: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v.token} type="button"
          onClick={() => onInsert(v.token)}
          className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent transition-colors font-mono"
          title={v.label}
        >
          {`{{${v.token}}}`}
        </button>
      ))}
    </div>
  )
}
