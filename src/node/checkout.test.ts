import { createClient } from '@klappay/node'
import { describe, expect, it } from 'vitest'
import { createCheckoutKit } from './checkout'

describe('createCheckoutKit', () => {
  it('defaults options to {}, so it can rely on @klappay/node@3.1+ falling back to KLAP_API_KEY/KLAP_BASE_URL', () => {
    expect(() => createCheckoutKit()).not.toThrow()
  })

  it('reuses an already-built @klappay/node client instead of creating a new one', () => {
    const client = createClient({ apiKey: 'klap_test_x', baseUrl: 'https://api.example.com' })
    const checkout = createCheckoutKit({ client })
    expect(checkout.client).toBe(client)
  })
})
