import type { AltToken, Network } from '../types'

export const SWAP_CHAIN_IDS: Record<Network, number> = {
  base: 8453,
  optimism: 10,
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  avalanche: 43114,
  bnb: 56,
}

export const ALT_TOKEN_ADDRESSES: Partial<
  Record<Network, Partial<Record<AltToken, `0x${string}`>>>
> = {
  base: { BTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' },
  optimism: { BTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095' },
  ethereum: { BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  arbitrum: { BTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f' },
  polygon: { BTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6' },
}

export const ALT_TOKEN_DECIMALS: Record<AltToken, number> = {
  ETH: 18,
  BNB: 18,
  MATIC: 18,
  AVAX: 18,
  BTC: 8,
}

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA'

export const MAX_UINT256 = 2n ** 256n - 1n

export function toBaseUnits(amount: number, decimals: number): bigint {
  const [whole, fraction = ''] = amount.toFixed(decimals).split('.')
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`)
}

export function encodeErc20Allowance(owner: string, spender: string): `0x${string}` {
  const ownerWord = owner.toLowerCase().replace('0x', '').padStart(64, '0')
  const spenderWord = spender.toLowerCase().replace('0x', '').padStart(64, '0')
  return `0xdd62ed3e${ownerWord}${spenderWord}`
}

export function encodeErc20Approve(spender: string, amountUnits: bigint): `0x${string}` {
  const spenderWord = spender.toLowerCase().replace('0x', '').padStart(64, '0')
  const amountWord = amountUnits.toString(16).padStart(64, '0')
  return `0x095ea7b3${spenderWord}${amountWord}`
}

export function appendPermit2Signature(data: string, signature: `0x${string}`): string {
  const signatureBytes = (signature.length - 2) / 2
  const lengthWord = signatureBytes.toString(16).padStart(64, '0')
  return `${data}${lengthWord}${signature.slice(2)}`
}
