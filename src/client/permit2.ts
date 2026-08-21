import { ALT_TOKEN_ADDRESSES, ALT_TOKEN_DECIMALS, CHAIN_IDS } from '@klappay/types/constants'

export { ALT_TOKEN_ADDRESSES, ALT_TOKEN_DECIMALS, CHAIN_IDS }

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
