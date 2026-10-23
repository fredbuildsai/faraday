import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const webhook = readFileSync('src/routes/lovable/email/auth/webhook.ts', 'utf8')
const configured = (name: string) => webhook.match(new RegExp(`const ${name} = "([^"]+)"`))?.[1]

describe('authentication email domain configuration', () => {
  it('uses the owner’s corrected verified sender domain', () => {
    expect(configured('SENDER_DOMAIN')).toBe('notify.faradayapp.frederick-chesneau.com')
  })
  it('sends from the root of the verified email domain', () => {
    expect(configured('FROM_DOMAIN')).toBe('faradayapp.frederick-chesneau.com')
  })
  it('keeps authentication destinations on the existing website', () => {
    expect(configured('ROOT_DOMAIN')).toBe('faraday.frederick-chesneau.com')
  })
})