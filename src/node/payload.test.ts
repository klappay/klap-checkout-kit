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
    requestedAmount: 10,
    merchantAmount: 9.8,
    gasFeeAmount: 0,
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

  it('passes requestedAmount and gasFeeAmount through so a price breakdown adds up to amount', () => {
    const payload = toCheckoutPayload(
      makeCharge({
        amount: 49.9,
        requestedAmount: 49.88,
        feeAmount: 0.9976,
        merchantAmount: 48.8824,
        gasFeeAmount: 0.02,
      }),
    )
    expect(payload.requestedAmount).toBe(49.88)
    expect(payload.gasFeeAmount).toBe(0.02)
    expect(payload.merchantAmount + payload.feeAmount + payload.gasFeeAmount).toBeCloseTo(
      payload.amount,
    )
  })

  it('keeps selfSettlement out of the payload, since it carries the merchant payout split', () => {
    const payload = toCheckoutPayload(
      makeCharge({
        settlementStatus: 'below_minimum',
        selfSettlement: {
          splitAddress: '0xabc0000000000000000000000000000000000abc',
          recipients: [
            { address: '0xdef0000000000000000000000000000000000def', percentAllocation: 100 },
          ],
          distributorFeePercent: 0,
          salt: '0x01',
          pairs: [{ token: 'USDC', network: 'base' }],
        },
      }),
    )
    expect(payload.settlementStatus).toBe('below_minimum')
    expect(payload).not.toHaveProperty('selfSettlement')
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

  it('passes the exact decimal-string amounts through, defaulting to null when absent', () => {
    const withExact = toCheckoutPayload(
      makeCharge({ amountExact: '10.000000', amountReceivedExact: '4.000000' }),
    )
    expect(withExact.amountExact).toBe('10.000000')
    expect(withExact.amountReceivedExact).toBe('4.000000')

    const withoutExact = toCheckoutPayload(makeCharge({}))
    expect(withoutExact.amountExact).toBeNull()
    expect(withoutExact.amountReceivedExact).toBeNull()
  })

  it('defaults paymentUnavailable to false when the charge does not carry it', () => {
    const payload = toCheckoutPayload(makeCharge({}))
    expect(payload.paymentUnavailable).toBe(false)
  })

  it('passes paymentUnavailable through so an integrator can pause payment instructions', () => {
    const payload = toCheckoutPayload(makeCharge({ paymentUnavailable: true }))
    expect(payload.paymentUnavailable).toBe(true)
  })
})
