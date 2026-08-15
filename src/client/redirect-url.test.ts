import { describe, expect, it } from 'vitest'
import { resolveRedirectUrl } from './redirect-url'

describe('resolveRedirectUrl', () => {
  it('returns null for no redirectUrl', () => {
    expect(resolveRedirectUrl(null)).toBeNull()
  })

  it('passes through http(s) URLs', () => {
    expect(resolveRedirectUrl('https://merchant.example/thanks')).toBe(
      'https://merchant.example/thanks',
    )
    expect(resolveRedirectUrl('http://localhost:3000/thanks')).toBe('http://localhost:3000/thanks')
  })

  it('rejects a non-http(s) scheme, only trusted when confirmed', () => {
    expect(resolveRedirectUrl('javascript:alert(1)')).toBeNull()
    expect(resolveRedirectUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('rejects an unparseable URL', () => {
    expect(resolveRedirectUrl('not a url')).toBeNull()
  })
})
