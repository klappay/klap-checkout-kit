import {
  CHAIN_IDS,
  EVM_NETWORKS,
  NETWORK_EXPLORERS,
  NETWORK_LABELS,
} from '@klappay/types/constants'
import type { EvmNetwork } from '@klappay/types/constants'
import type { Environment } from '../types'

type NativeCurrency = { name: string; symbol: string; decimals: number }

export type AddEthereumChainParameter = {
  chainId: string
  chainName: string
  nativeCurrency: NativeCurrency
  rpcUrls: string[]
  blockExplorerUrls?: string[]
}

const NATIVE_CURRENCIES: Record<EvmNetwork, NativeCurrency> = {
  ethereum: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  base: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  optimism: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  arbitrum: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  polygon: { name: 'POL', symbol: 'POL', decimals: 18 },
  avalanche: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  bnb: { name: 'BNB', symbol: 'BNB', decimals: 18 },
}

const PUBLIC_RPC_URLS: Record<EvmNetwork, Partial<Record<Environment, string>>> = {
  ethereum: {
    live: 'https://ethereum-rpc.publicnode.com',
    test: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
  base: { live: 'https://mainnet.base.org', test: 'https://sepolia.base.org' },
  optimism: { live: 'https://mainnet.optimism.io', test: 'https://sepolia.optimism.io' },
  arbitrum: { live: 'https://arb1.arbitrum.io/rpc' },
  polygon: { live: 'https://polygon-rpc.com' },
  avalanche: { live: 'https://api.avax.network/ext/bc/C/rpc' },
  bnb: { live: 'https://bsc-dataseed.binance.org' },
}

const ENVIRONMENTS: Environment[] = ['live', 'test']

function buildAddChainParams(): Map<number, AddEthereumChainParameter> {
  const params = new Map<number, AddEthereumChainParameter>()
  for (const network of EVM_NETWORKS) {
    for (const environment of ENVIRONMENTS) {
      const chainId = CHAIN_IDS[network][environment]
      const rpcUrl = PUBLIC_RPC_URLS[network][environment]
      if (!chainId || !rpcUrl) continue
      params.set(chainId, {
        chainId: `0x${chainId.toString(16)}`,
        chainName:
          environment === 'live' ? NETWORK_LABELS[network] : `${NETWORK_LABELS[network]} Testnet`,
        nativeCurrency: NATIVE_CURRENCIES[network],
        rpcUrls: [rpcUrl],
        ...(environment === 'live' ? { blockExplorerUrls: [NETWORK_EXPLORERS[network]] } : {}),
      })
    }
  }
  return params
}

const ADD_CHAIN_PARAMS = buildAddChainParams()

export function getAddEthereumChainParams(chainId: number): AddEthereumChainParameter | null {
  return ADD_CHAIN_PARAMS.get(chainId) ?? null
}
