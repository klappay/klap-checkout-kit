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

  it('does not leak floating-point noise into an 18-decimal scale', () => {
    expect(toTokenUnits(49.9, 18)).toBe(49_900_000_000_000_000_000n)
    expect(toTokenUnits(10.034271, 18)).toBe(10_034_271_000_000_000_000n)
  })

  it('still rounds a value more precise than the token scale', () => {
    expect(toTokenUnits(1.2345678, 6)).toBe(1_234_568n)
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

describe('remainingAmountUnits', () => {
  it('prefers the exact decimal strings over the JSON numbers', () => {
    const charge = makeCharge({
      amount: 49.9,
      amountExact: '49.900000',
      amountReceived: 49.9,
      amountReceivedExact: '49.899999999999998579',
    })
    expect(remainingAmountUnits(charge, 18)).toBe(1421n)
  })

  it('rounds up to the token scale so a payment is never left short', () => {
    const charge = makeCharge({
      amount: 10,
      amountExact: '10.000000',
      amountReceived: 5,
      amountReceivedExact: '4.999999000000000001',
    })
    expect(remainingAmountUnits(charge, 6)).toBe(5_000_001n)
  })

  it('falls back to the JSON numbers for a charge without exact fields', () => {
    expect(remainingAmountUnits({ amount: 49.9, amountReceived: null }, 18)).toBe(
      49_900_000_000_000_000_000n,
    )
    expect(remainingAmountUnits({ amount: 10.034271, amountReceived: 5.01 })).toBe(5_024_271n)
  })

  it('clamps to zero on an overpaid charge', () => {
    expect(
      remainingAmountUnits(
        makeCharge({ amountExact: '10.000000', amountReceivedExact: '12.5', amountReceived: 12.5 }),
      ),
    ).toBe(0n)
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

  it('asks an 18-decimal wallet for the exact amount, never a float-noise short of it', () => {
    const charge = makeCharge({
      amount: 49.9,
      amountExact: '49.900000',
      environment: 'live',
      acceptedPayments: [{ token: 'USDT', network: 'bnb' }],
    })

    expect(resolvePaymentOptions(charge)[0]?.amountUnits).toBe('49900000000000000000')
  })

  it('computes the same exact 18-decimal amount from the JSON number alone', () => {
    const charge = makeCharge({
      amount: 5.012345,
      environment: 'live',
      acceptedPayments: [{ token: 'USDT', network: 'bnb' }],
    })

    expect(resolvePaymentOptions(charge)[0]?.amountUnits).toBe('5012345000000000000')
  })

  it('keeps offering payment when only exact dust is missing, as Core still has the charge open', () => {
    const charge = makeCharge({
      amount: 49.9,
      amountExact: '49.900000',
      amountReceived: 49.9,
      amountReceivedExact: '49.899999999999998579',
      environment: 'live',
      acceptedPayments: [
        { token: 'USDT', network: 'bnb' },
        { token: 'USDC', network: 'base' },
      ],
    })

    const options = resolvePaymentOptions(charge)

    expect(options.find((option) => option.network === 'bnb')?.amountUnits).toBe('1421')
    expect(options.find((option) => option.network === 'base')?.amountUnits).toBe('1')
  })

  it('returns no options when the exact received amount covers the charge', () => {
    const charge = makeCharge({
      amount: 49.9,
      amountExact: '49.900000',
      amountReceived: 49.9,
      amountReceivedExact: '49.900000000000000000',
    })

    expect(resolvePaymentOptions(charge)).toEqual([])
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
