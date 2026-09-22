import { CHAIN_IDS, TOKEN_DECIMALS, getTokenDeployment } from '@klappay/types'
import type { Charge } from '@klappay/types'
import type { PaymentOption } from '../types'

export function toTokenUnits(amount: number, decimals: number = TOKEN_DECIMALS): bigint {
  const [whole, fraction = ''] = amount.toFixed(decimals).split('.')
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`)
}

export function remainingAmount(charge: Pick<Charge, 'amount' | 'amountReceived'>): number {
  const remaining = charge.amount - (charge.amountReceived ?? 0)
  return remaining > 0 ? remaining : 0
}

export function remainingAmountUnits(charge: Pick<Charge, 'amount' | 'amountReceived'>): bigint {
  return toTokenUnits(remainingAmount(charge))
}

export function resolvePaymentOptions(charge: Charge): PaymentOption[] {
  const remaining = remainingAmount(charge)
  if (remaining <= 0) return []

  return charge.acceptedPayments.map((pair) => {
    const deployment = getTokenDeployment(pair.token, pair.network, charge.environment)
    return {
      ...pair,
      chainId: CHAIN_IDS[pair.network]?.[charge.environment] ?? null,
      contractAddress: deployment?.address ?? null,
      amountUnits: toTokenUnits(remaining, deployment?.decimals ?? TOKEN_DECIMALS).toString(),
    }
  })
}
