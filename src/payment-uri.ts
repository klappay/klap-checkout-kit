import type { PaymentOption } from './types'

export function encodeErc20Transfer(to: string, amountUnits: string): `0x${string}` {
  const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0')
  const paddedAmount = BigInt(amountUnits).toString(16).padStart(64, '0')
  return `0xa9059cbb${paddedTo}${paddedAmount}`
}

export function buildPaymentUri(option: PaymentOption, address: string): string {
  if (option.chainId === null || option.contractAddress === null) {
    throw new Error(
      `No wallet-payable chain mapping for ${option.token} on ${option.network} — render \`address\` directly (e.g. as a QR code) instead.`,
    )
  }
  const params = new URLSearchParams({ address, uint256: option.amountUnits })
  return `ethereum:${option.contractAddress}@${option.chainId}/transfer?${params.toString()}`
}
