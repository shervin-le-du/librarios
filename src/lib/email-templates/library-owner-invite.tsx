import * as React from 'react'
import type { TemplateEntry } from './registry'
import { EmailLayout, type BaseInviteProps } from './_shared'
import { TEMPLATE_META } from './_meta'

const meta = TEMPLATE_META['library-owner-invite']

function LibraryOwnerInviteEmail(props: BaseInviteProps) {
  const vars = {
    recipientName: props.recipientName || 'there',
    inviterName: props.inviterName || 'The team',
    libraryName: props.libraryName || 'your library',
    role: props.role || 'owner',
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
  component: LibraryOwnerInviteEmail,
  subject: (data: Record<string, any>) => {
    const raw = data?.subject || meta.defaults.subject
    return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m: string, k: string) => data?.[k] ?? '')
  },
  displayName: meta.label,
  previewData: {
    recipientName: 'Alex',
    inviterName: 'Platform team',
    libraryName: 'Riverside Public Library',
    role: 'owner',
    acceptUrl: 'https://example.com/accept-invite?token=demo',
    expiresIn: '14 days',
    siteName: 'Librarios',
    accentColor: '#2563eb',
  },
} satisfies TemplateEntry
