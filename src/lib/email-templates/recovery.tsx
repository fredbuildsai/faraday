import { EmailBrandHeader, emailBrand } from './brand'
import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  token,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailBrandHeader />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        {token && <>
          <Text style={text}>If the link does not work, open the password-reset page and enter your email and this code:</Text>
          <Text style={{ ...h1, fontFamily: 'Courier, monospace' }}>{token}</Text>
        </>}
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: emailBrand.white, fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 25px', maxWidth: '560px' }
const h1 = {
  fontFamily: 'Georgia, serif',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: emailBrand.ink,
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: emailBrand.muted,
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: emailBrand.blue,
  color: emailBrand.white,
  fontSize: '14px',
  border: `1px solid ${emailBrand.blue}`,
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #002395 !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #002395 !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #002395 !important; color: #ffffff !important; }
`
