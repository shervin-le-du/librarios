import type { EmailContent } from './_shared'

export type InviteTemplateKey =
  | 'library-owner-invite'
  | 'platform-admin-invite'
  | 'library-staff-invite'
  | 'member-invite'

export interface TemplateMeta {
  key: InviteTemplateKey
  label: string
  description: string
  variables: Array<{ token: string; label: string }>
  defaults: Required<EmailContent>
}

const COMMON_VARS = [
  { token: 'recipientName', label: 'Recipient name' },
  { token: 'inviterName', label: 'Inviter name' },
  { token: 'libraryName', label: 'Library name' },
  { token: 'role', label: 'Role' },
  { token: 'acceptUrl', label: 'Accept URL' },
  { token: 'expiresIn', label: 'Expires in' },
  { token: 'siteName', label: 'Site name' },
]

export const TEMPLATE_META: Record<InviteTemplateKey, TemplateMeta> = {
  'library-owner-invite': {
    key: 'library-owner-invite',
    label: 'Library owner invitation',
    description: 'Sent when the platform invites someone to become the owner of a new library.',
    variables: COMMON_VARS,
    defaults: {
      subject: 'You have been invited to run {{libraryName}} on {{siteName}}',
      heading: 'Welcome to {{siteName}}',
      intro: 'Hi {{recipientName}},',
      body:
        '{{inviterName}} invited you to become the owner of {{libraryName}}.\n\nAccept the invitation to set up your account and start managing your library.',
      buttonLabel: 'Accept invitation',
      expiryNote: 'This invitation expires in {{expiresIn}}.',
    },
  },
  'platform-admin-invite': {
    key: 'platform-admin-invite',
    label: 'Platform admin invitation',
    description: 'Sent when a platform owner or super admin invites someone to the platform team.',
    variables: COMMON_VARS,
    defaults: {
      subject: 'You have been invited to the {{siteName}} platform team',
      heading: 'Join the {{siteName}} team',
      intro: 'Hi {{recipientName}},',
      body:
        '{{inviterName}} invited you to join the {{siteName}} platform team as {{role}}.\n\nAccept the invitation to get access to the platform admin console.',
      buttonLabel: 'Accept invitation',
      expiryNote: 'This invitation expires in {{expiresIn}}.',
    },
  },
  'library-staff-invite': {
    key: 'library-staff-invite',
    label: 'Library staff invitation',
    description: 'Sent when a library owner or admin invites a colleague as staff.',
    variables: COMMON_VARS,
    defaults: {
      subject: '{{inviterName}} invited you to join {{libraryName}}',
      heading: 'Join {{libraryName}}',
      intro: 'Hi {{recipientName}},',
      body:
        '{{inviterName}} invited you to join {{libraryName}} as {{role}}.\n\nAccept to create your account and start using the library workspace.',
      buttonLabel: 'Accept invitation',
      expiryNote: 'This invitation expires in {{expiresIn}}.',
    },
  },
  'member-invite': {
    key: 'member-invite',
    label: 'Member (patron) invitation',
    description: 'Sent to a patron so they can create an account and access their member portal.',
    variables: COMMON_VARS,
    defaults: {
      subject: 'Your {{libraryName}} member account is ready',
      heading: 'Welcome to {{libraryName}}',
      intro: 'Hi {{recipientName}},',
      body:
        '{{libraryName}} has set up a member account for you.\n\nActivate your account to view your loans, place holds, and manage your profile online.',
      buttonLabel: 'Activate my account',
      expiryNote: 'This link expires in {{expiresIn}}.',
    },
  },
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_META) as InviteTemplateKey[]
