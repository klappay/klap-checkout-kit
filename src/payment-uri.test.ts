import { describe, expect, it } from 'vitest'
import { buildPaymentUri, encodeErc20Transfer } from './payment-uri'
import type { PaymentOption } from './types'

const option: PaymentOption = {
  token: 'USDC',
  network: 'base',
  chainId: 8453,
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amountUnits: '10000000',
}

describe('encodeErc20Transfer', () => {
  it('encodes the ERC-20 transfer(address,uint256) selector with padded args', () => {
    const calldata = encodeErc20Transfer(
      '0xabc0000000000000000000000000000000000abc'.slice(0, 42),
      '10000000',
    )
    expect(calldata.startsWith('0xa9059cbb')).toBe(true)
    expect(calldata).toHaveLength(2 + 8 + 64 + 64)
  })
})

describe('buildPaymentUri', () => {
  it('builds an EIP-681 transfer URI from a resolved payment option', () => {
    const uri = buildPaymentUri(option, '0xabc0000000000000000000000000000000000abc')
    expect(uri).toBe(
      `ethereum:${option.contractAddress}@8453/transfer?address=0xabc0000000000000000000000000000000000abc&uint256=10000000`,
    )
  })

  it('throws for a non-wallet-payable option instead of building a broken URI', () => {
    const unmapped: PaymentOption = { ...option, chainId: null, contractAddress: null }
    expect(() => buildPaymentUri(unmapped, '0xabc0000000000000000000000000000000000abc')).toThrow(
      /No wallet-payable chain mapping/,
    )
  })
})
