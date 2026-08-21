import { describe, expect, it } from 'vitest'
import {
  appendPermit2Signature,
  encodeErc20Allowance,
  encodeErc20Approve,
  toBaseUnits,
} from './permit2'

describe('encodeErc20Allowance', () => {
  it('encodes allowance(owner, spender) with the correct selector and padded args', () => {
    const data = encodeErc20Allowance(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    )
    expect(data).toBe(
      `0xdd62ed3e${'11'.repeat(20).padStart(64, '0')}${'22'.repeat(20).padStart(64, '0')}`,
    )
  })

  it('lowercases mixed-case addresses before encoding', () => {
    const lower = encodeErc20Allowance(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0x1111111111111111111111111111111111111111',
    )
    const mixed = encodeErc20Allowance(
      '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      '0x1111111111111111111111111111111111111111',
    )
    expect(mixed).toBe(lower)
  })
})

describe('encodeErc20Approve', () => {
  it('encodes approve(spender, amount) with the correct selector and a full-width amount', () => {
    const data = encodeErc20Approve('0x2222222222222222222222222222222222222222', 255n)
    expect(data).toBe(`0x095ea7b3${'22'.repeat(20).padStart(64, '0')}${'ff'.padStart(64, '0')}`)
  })

  it('pads a max-uint256 amount to exactly 64 hex chars of all f', () => {
    const maxUint256 = 2n ** 256n - 1n
    const data = encodeErc20Approve('0x2222222222222222222222222222222222222222', maxUint256)
    expect(data.slice(-64)).toBe('f'.repeat(64))
  })
})

describe('appendPermit2Signature', () => {
  it('appends a 32-byte big-endian signature length, then the raw signature', () => {
    const signature = `0x${'ab'.repeat(65)}` as const
    const result = appendPermit2Signature('0xdeadbeef', signature)
    expect(result).toBe(`0xdeadbeef${(65).toString(16).padStart(64, '0')}${'ab'.repeat(65)}`)
  })

  it('encodes the signature length as exactly 32 bytes regardless of signature size', () => {
    const shortSignature = `0x${'11'.repeat(10)}` as const
    const result = appendPermit2Signature('0x', shortSignature)
    expect(result).toBe(`0x${(10).toString(16).padStart(64, '0')}${'11'.repeat(10)}`)
  })
})

describe('toBaseUnits', () => {
  it('converts a decimal amount to the smallest unit for the given decimals', () => {
    expect(toBaseUnits(0.0002, 8)).toBe(20_000n)
  })

  it('handles a whole-number amount with no fractional part', () => {
    expect(toBaseUnits(5, 18)).toBe(5_000_000_000_000_000_000n)
  })
})
