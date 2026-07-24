import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Img,
  Hr,
} from '@react-email/components'

export interface EmailBrand {
  siteName?: string
  accentColor?: string
  logoUrl?: string
  footerText?: string
}

export interface EmailContent {
  subject?: string
  heading?: string
  intro?: string
  body?: string
  buttonLabel?: string
  expiryNote?: string
}

export interface BaseInviteProps extends EmailBrand, EmailContent {
  recipientName?: string
  inviterName?: string
  libraryName?: string
  role?: string
  acceptUrl?: string
  expiresIn?: string
}

const DEFAULT_ACCENT = '#2563eb'

export function substitute(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => vars[key] ?? '')
}

interface LayoutProps {
  brand: EmailBrand
  preview: string
  heading: string
  intro?: string
  body?: string
  buttonLabel?: string
  buttonUrl?: string
  expiryNote?: string
  vars: Record<string, string | undefined>
}

export function EmailLayout({
  brand,
  preview,
  heading,
  intro,
  body,
  buttonLabel,
  buttonUrl,
  expiryNote,
  vars,
}: LayoutProps) {
  const accent = brand.accentColor || DEFAULT_ACCENT
  const siteName = brand.siteName || 'Librarios'
  const footer = brand.footerText || ''

  return (
    <Html lang="en">
      <Head />
      <Preview>{substitute(preview, vars)}</Preview>
      <Body style={main}>
        <Container style={container}>
          {brand.logoUrl ? (
            <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Img src={brand.logoUrl} alt={siteName} height="40" style={{ margin: '0 auto' }} />
            </Section>
          ) : (
            <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Text style={{ ...brandName, color: accent }}>{siteName}</Text>
            </Section>
          )}

          <Section style={card}>
            <Heading style={{ ...h1, color: '#111827' }}>{substitute(heading, vars)}</Heading>
            {intro && <Text style={paragraph}>{substitute(intro, vars)}</Text>}
            {body && (
              <Text style={paragraph}>
                {substitute(body, vars).split('\n').map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </Text>
            )}

            {buttonUrl && buttonLabel && (
              <Section style={{ textAlign: 'center', margin: '32px 0' }}>
                <Button
                  href={buttonUrl}
                  style={{
                    backgroundColor: accent,
                    color: '#ffffff',
                    padding: '12px 28px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  {substitute(buttonLabel, vars)}
                </Button>
              </Section>
            )}


            {expiryNote && (
              <Text style={smallMuted}>{substitute(expiryNote, vars)}</Text>
            )}
          </Section>

          <Hr style={hr} />
          <Text style={footerStyle}>{footer}</Text>
          <Text style={footerStyle}>© {new Date().getFullYear()} {siteName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 20px',
}
const card: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '32px',
}
const brandName: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  margin: 0,
}
const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 16px',
  lineHeight: 1.3,
}
const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  color: '#374151',
  margin: '0 0 12px',
}
const smallMuted: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '16px 0 0',
  lineHeight: 1.5,
}
const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '32px 0 16px',
}
const footerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '4px 0',
}
