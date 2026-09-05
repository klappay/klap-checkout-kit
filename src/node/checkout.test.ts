import { createClient } from '@klappay/node'
import type { Charge } from '@klappay/types'
import { describe, expect, it, vi } from 'vitest'
import { createCheckoutKit } from './checkout'

function makeCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'ch_test123',
    amount: 10,
    feePayer: 'merchant',
    feePercent: 2,
    feeAmount: 0.2,
    merchantAmount: 9.8,
    amountReceived: null,
    isOverpaid: false,
    currency: 'USD',
    acceptedPayments: [{ token: 'USDC', network: 'base' }],
    paidWith: [],
    swapAlternatives: [],
    address: '0xabc0000000000000000000000000000000000abc',
    status: 'pending',
    settlementStatus: null,
    environment: 'live',
    apiKeyId: 'ak_1',
    txHash: null,
    externalRef: 'order_1',
    source: 'checkout',
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T01:00:00.000Z',
    confirmedAt: null,
    settledAt: null,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    redirectUrl: null,
    checkoutUrl: null,
    splitRecipients: [],
    escrow: null,
    ...overrides,
  }
}

describe('createCheckoutKit', () => {
  it('defaults options to {}, so it can rely on @klappay/node@3.1+ falling back to KLAP_API_KEY/KLAP_BASE_URL', () => {
    expect(() => createCheckoutKit()).not.toThrow()
  })

  it('reuses an already-built @klappay/node client instead of creating a new one', () => {
    const client = createClient({ apiKey: 'klap_test_x', baseUrl: 'https://api.example.com' })
    const checkout = createCheckoutKit({ client })
    expect(checkout.client).toBe(client)
  })

  it('surfaces transactionSender and confirmationProgress from charges.check() on the checkout payload', async () => {
    const client = createClient({ apiKey: 'klap_test_x', baseUrl: 'https://api.example.com' })
    const confirmationProgress = { network: 'base', blocksSeen: 3, blocksRequired: 12, percent: 25 }
    client.charges.check = vi.fn().mockResolvedValue({
      ...makeCharge(),
      transactionSender: '0xswapaggregator',
      confirmationProgress,
    })
    const checkout = createCheckoutKit({ client })

    const payload = await checkout.checkCheckout('ch_test123')

    expect(payload.transactionSender).toBe('0xswapaggregator')
    expect(payload.confirmationProgress).toEqual(confirmationProgress)
  })

  it('discriminates charge and confirmation_progress SSE events in watchCheckoutWithProgress', async () => {
    const client = createClient({ apiKey: 'klap_test_x', baseUrl: 'https://api.example.com' })
    const confirmationProgress = { network: 'base', blocksSeen: 3, blocksRequired: 12, percent: 25 }
    client.charges.watchEvents = vi.fn().mockReturnValue(
      (async function* () {
        yield { event: 'confirmation_progress', data: confirmationProgress }
        yield { event: 'charge', data: makeCharge({ status: 'confirmed' }) }
      })(),
    )
    const checkout = createCheckoutKit({ client })

    const events = []
    for await (const event of checkout.watchCheckoutWithProgress('ch_test123')) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: 'confirmation_progress', progress: confirmationProgress },
      { type: 'charge', payload: expect.objectContaining({ status: 'confirmed' }) },
    ])
  })
})
