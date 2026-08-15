import { TOKEN_ADDRESSES, TOKEN_DECIMALS } from '@klappay/types'
import type { Charge, Environment, Network } from '@klappay/types'
import type { PaymentOption } from '../types'

const CHAIN_IDS: Record<Network, Partial<Record<Environment, number>>> = {
  base: { live: 8453, test: 84532 },
  optimism: { live: 10, test: 11155420 },
  ethereum: { live: 1, test: 11155111 },
  polygon: { live: 137 },
  arbitrum: { live: 42161 },
  avalanche: { live: 43114 },
  bnb: { live: 56 },
}

export function toTokenUnits(amount: number, decimals: number = TOKEN_DECIMALS): bigint {
  const [whole, fraction = ''] = amount.toFixed(decimals).split('.')
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`)
}

export function remainingAmountUnits(charge: Pick<Charge, 'amount' | 'amountReceived'>): bigint {
  const target = toTokenUnits(charge.amount)
  const received = toTokenUnits(charge.amountReceived ?? 0)
  const remaining = target - received
  return remaining > 0n ? remaining : 0n
}

export function resolvePaymentOptions(charge: Charge): PaymentOption[] {
  const amountUnits = remainingAmountUnits(charge)
  if (amountUnits <= 0n) return []

  return charge.acceptedPayments.map((pair) => ({
    ...pair,
    chainId: CHAIN_IDS[pair.network]?.[charge.environment] ?? null,
    contractAddress: TOKEN_ADDRESSES[pair.token]?.[pair.network]?.[charge.environment] ?? null,
    amountUnits: amountUnits.toString(),
  }))
}
