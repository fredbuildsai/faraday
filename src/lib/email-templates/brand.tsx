import * as React from 'react'
import { Img, Section, Text } from '@react-email/components'

// Email clients require inline styles; shared brand tokens live here.
export const emailBrand = { blue: '#002395', white: '#ffffff', ink: '#202124', muted: '#55575d' }
export function EmailBrandHeader() {
  return <Section style={{ textAlign: 'center', marginBottom: '32px' }}>
    <Text style={{ margin: '0', fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 600, color: emailBrand.ink }}>
      <Img src="https://faraday.frederick-chesneau.com/apple-touch-icon.png" alt="" width="31" height="31" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />Faraday
    </Text>
    <Text style={{ margin: '10px 0 0', fontSize: '11px', color: emailBrand.muted }}>GET OUT OF THE CAGE</Text>
  </Section>
}
