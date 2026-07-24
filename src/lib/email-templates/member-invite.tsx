import * as React from 'react'
import type { TemplateEntry } from './registry'
import { EmailLayout, type BaseInviteProps } from './_shared'
import { TEMPLATE_META } from './_meta'

const meta = TEMPLATE_META['member-invite']

function MemberInviteEmail(props: BaseInviteProps) {
  const vars = {
    recipientName: props.recipientName || 'there',
    inviterName: props.inviterName || 'The library team',
    libraryName: props.libraryName || 'your library',
    role: props.role || 'member',
    acceptUrl: props.acceptUrl || '',
    expiresIn: props.expiresIn || '14 days',
    siteName: props.siteName || 'Librarios',
  }
  return (
    <EmailLayout
      brand={props}
      preview={props.subject || meta.defaults.subject}
      heading={props.heading || meta.defaults.heading}
      intro={props.intro || meta.defaults.intro}
      body={props.body || meta.defaults.body}
      buttonLabel={props.buttonLabel || meta.defaults.buttonLabel}
      buttonUrl={props.acceptUrl}
      expiryNote={props.expiryNote || meta.defaults.expiryNote}
      vars={vars}
    />
  )
}

export const template = {
  component: MemberInviteEmail,
  subject: (data: Record<string, any>) => {
    const raw = data?.subject || meta.defaults.subject
    return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m: string, k: string) => data?.[k] ?? '')
  },
  displayName: meta.label,
  previewData: {
    recipientName: 'Robin',
    libraryName: 'Riverside Public Library',
    role: 'member',
    acceptUrl: 'https://example.com/riverside/activate/demo',
    expiresIn: '14 days',
    siteName: 'Librarios',
    accentColor: '#2563eb',
  },
} satisfies TemplateEntry
