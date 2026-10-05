import type { Charge } from '@klappay/types'
import { describe, expect, it } from 'vitest'
import {
  remainingAmount,
  remainingAmountUnits,
  resolvePaymentOptions,
  toTokenUnits,
} from './wallet-payment'

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
    escrow: null,
    ...overrides,
  }
}

describe('toTokenUnits', () => {
  it('converts a decimal amount into base units for the given decimals', () => {
    expect(toTokenUnits(10, 6)).toBe(10_000_000n)
    expect(toTokenUnits(0.5, 6)).toBe(500_000n)
  })
})

describe('remainingAmount', () => {
  it('returns the full amount when nothing has been received', () => {
    expect(remainingAmount(makeCharge({ amount: 10, amountReceived: null }))).toBe(10)
  })

  it('subtracts what has already been received', () => {
    expect(remainingAmount(makeCharge({ amount: 10, amountReceived: 4 }))).toBe(6)
  })

  it('never goes negative when overpaid', () => {
    expect(remainingAmount(makeCharge({ amount: 10, amountReceived: 15 }))).toBe(0)
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

  it('resolves a chain id for arc, an EVM-compatible network with no wallet-mapping gap', () => {
    const charge = makeCharge({
      amount: 10,
      amountReceived: null,
      environment: 'live',
      acceptedPayments: [{ token: 'USDC', network: 'arc' }],
    })

    const options = resolvePaymentOptions(charge)

    expect(options[0]).toMatchObject({
      token: 'USDC',
      network: 'arc',
      chainId: 5042,
      contractAddress: '0x3600000000000000000000000000000000000000',
    })
  })

  it('leaves chain id null for tron — not EVM, so no wallet mapping exists, but still payable by address', () => {
    const charge = makeCharge({
      amount: 10,
      amountReceived: null,
      environment: 'live',
      acceptedPayments: [{ token: 'USDT', network: 'tron' }],
    })

    const options = resolvePaymentOptions(charge)

    expect(options[0]).toMatchObject({
      token: 'USDT',
      network: 'tron',
      chainId: null,
    })
    expect(options[0]?.contractAddress).not.toBeNull()
  })

  it('returns no options once the charge is fully paid', () => {
    const charge = makeCharge({ amount: 10, amountReceived: 10 })
    expect(resolvePaymentOptions(charge)).toEqual([])
  })

  it("uses each pair's own deployment decimals, not a flat default", () => {
    const charge = makeCharge({
      amount: 10,
      amountReceived: null,
      environment: 'live',
      acceptedPayments: [
        { token: 'USDC', network: 'base' },
        { token: 'USDT', network: 'bnb' },
      ],
    })

    const options = resolvePaymentOptions(charge)

    const base = options.find((option) => option.network === 'base')
    const bnb = options.find((option) => option.network === 'bnb')
    expect(base?.amountUnits).toBe(toTokenUnits(10, 6).toString())
    expect(bnb?.amountUnits).toBe(toTokenUnits(10, 18).toString())
    expect(bnb?.amountUnits).not.toBe(base?.amountUnits)
  })

  it('resolves arc mixed with another EVM network, sending arc USDC at its 6-decimal ERC-20 scale, not its 18-decimal native gas scale', () => {
    const charge = makeCharge({
      amount: 10,
      amountReceived: null,
      environment: 'test',
      acceptedPayments: [
        { token: 'USDC', network: 'arc' },
        { token: 'USDC', network: 'base' },
      ],
    })

    const options = resolvePaymentOptions(charge)

    expect(options).toHaveLength(2)
    expect(options.find((option) => option.network === 'arc')).toMatchObject({
      chainId: 5042002,
      contractAddress: '0x3600000000000000000000000000000000000000',
      amountUnits: '10000000',
    })
    expect(options.find((option) => option.network === 'base')).toMatchObject({
      chainId: 84532,
      amountUnits: '10000000',
    })
  })
})
