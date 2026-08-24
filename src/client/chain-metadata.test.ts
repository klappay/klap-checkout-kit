import { describe, expect, it } from 'vitest'
import { getAddEthereumChainParams } from './chain-metadata'

describe('getAddEthereumChainParams', () => {
  it('returns null for a chainId with no known mapping', () => {
    expect(getAddEthereumChainParams(999999)).toBeNull()
  })

  it('builds live chain params with a hex chainId, native currency, RPC, and explorer', () => {
    const params = getAddEthereumChainParams(8453)

    expect(params).toEqual({
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    })
  })

  it('builds test chain params with a "Testnet" name and no block explorer', () => {
    const params = getAddEthereumChainParams(84532)

    expect(params).toEqual({
      chainId: '0x14a34',
      chainName: 'Base Testnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
    })
  })

  it('resolves a non-ETH native currency correctly (Polygon)', () => {
    const params = getAddEthereumChainParams(137)

    expect(params?.nativeCurrency).toEqual({ name: 'POL', symbol: 'POL', decimals: 18 })
    expect(params?.chainId).toBe('0x89')
  })
})
