import type { Charge } from '@klappay/types'
import { describe, expect, it } from 'vitest'
import { remainingAmountUnits, resolvePaymentOptions, toTokenUnits } from './wallet-payment'

function makeCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'ch_test123',
    amount: 10,
    amountReceived: null,
    isOverpaid: false,
    currency: 'USD',
    acceptedPayments: [{ token: 'USDC', network: 'base' }],
    paidWith: [],
    address: '0xabc0000000000000000000000000000000000abc',
    status: 'pending',
    settlementStatus: null,
    environment: 'live',
    apiKeyId: null,
    txHash: null,
    externalRef: null,
    source: null,
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T01:00:00.000Z',
    confirmedAt: null,
    settledAt: null,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    redirectUrl: null,
    checkoutUrl: null,
    splitRecipients: [],
    ...overrides,
  }
}

describe('toTokenUnits', () => {
  it('converts a decimal amount into base units for the given decimals', () => {
    expect(toTokenUnits(10, 6)).toBe(10_000_000n)
    expect(toTokenUnits(0.5, 6)).toBe(500_000n)
  })
})

describe('remainingAmountUnits', () => {
  it('returns the full amount when nothing has been received', () => {
    const charge = makeCharge({ amount: 10, amountReceived: null })
    expect(remainingAmountUnits(charge)).toBe(toTokenUnits(10))
  })

  it('subtracts what has already been received', () => {
    const charge = makeCharge({ amount: 10, amountReceived: 4 })
    expect(remainingAmountUnits(charge)).toBe(toTokenUnits(6))
  })

  it('never goes negative when overpaid', () => {
    const charge = makeCharge({ amount: 10, amountReceived: 15 })
    expect(remainingAmountUnits(charge)).toBe(0n)
  })
})

describe('resolvePaymentOptions', () => {
  it('resolves chain id, contract address, and remaining amount per accepted pair', () => {
    const charge = makeCharge({
      amount: 10,
      amountReceived: null,
      environment: 'live',
      acceptedPayments: [
        { token: 'USDC', network: 'base' },
        { token: 'USDT', network: 'polygon' },
      ],
    })

    const options = resolvePaymentOptions(charge)

    expect(options).toHaveLength(2)
    expect(options[0]).toMatchObject({ token: 'USDC', network: 'base', chainId: 8453 })
    expect(options[1]).toMatchObject({ token: 'USDT', network: 'polygon', chainId: 137 })
    for (const option of options) {
      expect(option.amountUnits).toBe(toTokenUnits(10).toString())
    }
  })

  it('still includes a pair with no resolvable chain id — payable by QR/address, just not wallet', () => {
    const charge = makeCharge({
      environment: 'test',
      acceptedPayments: [{ token: 'USDC', network: 'polygon' }],
    })

    const options = resolvePaymentOptions(charge)

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({
      token: 'USDC',
      network: 'polygon',
      chainId: null,
      contractAddress: null,
    })
  })

  it('returns no options once the charge is fully paid', () => {
    const charge = makeCharge({ amount: 10, amountReceived: 10 })
    expect(resolvePaymentOptions(charge)).toEqual([])
  })
})
