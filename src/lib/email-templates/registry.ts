import type { ComponentType } from 'react'
import { template as libraryOwnerInvite } from './library-owner-invite'
import { template as platformAdminInvite } from './platform-admin-invite'
import { template as libraryStaffInvite } from './library-staff-invite'
import { template as memberInvite } from './member-invite'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'library-owner-invite': libraryOwnerInvite,
  'platform-admin-invite': platformAdminInvite,
  'library-staff-invite': libraryStaffInvite,
  'member-invite': memberInvite,
}
