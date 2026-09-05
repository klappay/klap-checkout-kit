import type { Charge } from '@klappay/types'
import { describe, expect, it } from 'vitest'
import { toCheckoutPayload } from './payload'

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

describe('toCheckoutPayload', () => {
  it('does not leak the merchant-internal bookkeeping fields into the payload', () => {
    const payload = toCheckoutPayload(makeCharge())
    expect(payload).not.toHaveProperty('apiKeyId')
    expect(payload).not.toHaveProperty('externalRef')
    expect(payload).not.toHaveProperty('source')
    expect(payload).not.toHaveProperty('metadata')
  })

  it('passes redirectUrl through so an integrator can send the payer back after payment', () => {
    const payload = toCheckoutPayload(
      makeCharge({ redirectUrl: 'https://merchant.example/thanks' }),
    )
    expect(payload.redirectUrl).toBe('https://merchant.example/thanks')
  })

  it('passes swapAlternatives through so an integrator can offer swap-to-pay', () => {
    const payload = toCheckoutPayload(
      makeCharge({ swapAlternatives: [{ token: 'ETH', network: 'base' }] }),
    )
    expect(payload.swapAlternatives).toEqual([{ token: 'ETH', network: 'base' }])
  })

  it('passes the fee breakdown through so an integrator can render a price breakdown', () => {
    const payload = toCheckoutPayload(
      makeCharge({ feePayer: 'payer', feePercent: 2, feeAmount: 0.2, merchantAmount: 9.8 }),
    )
    expect(payload.feePayer).toBe('payer')
    expect(payload.feePercent).toBe(2)
    expect(payload.feeAmount).toBe(0.2)
    expect(payload.merchantAmount).toBe(9.8)
  })
})
