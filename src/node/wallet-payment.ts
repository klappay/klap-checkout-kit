import { CHAIN_IDS, TOKEN_DECIMALS, getTokenDeployment } from '@klappay/types'
import type { Charge } from '@klappay/types'
import { isEvmNetwork } from '../types'
import type { PaymentOption } from '../types'

const CORE_AMOUNT_DECIMALS = 6
const ACCOUNTING_DECIMALS = 18

type RemainingAmountInput = Pick<
  Charge,
  'amount' | 'amountExact' | 'amountReceived' | 'amountReceivedExact'
>

export function toTokenUnits(amount: number, decimals: number = TOKEN_DECIMALS): bigint {
  const precision = Math.min(decimals, CORE_AMOUNT_DECIMALS)
  const [whole, fraction = ''] = amount.toFixed(precision).split('.')
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`)
}

function toAccountingUnits(exact: string | null | undefined, amount: number | null): bigint {
  const value = exact ?? (amount ?? 0).toFixed(CORE_AMOUNT_DECIMALS)
  const [whole, fraction = ''] = value.split('.')
  return BigInt(
    `${whole}${fraction.padEnd(ACCOUNTING_DECIMALS, '0').slice(0, ACCOUNTING_DECIMALS)}`,
  )
}

function remainingAccountingUnits(charge: RemainingAmountInput): bigint {
  const remaining =
    toAccountingUnits(charge.amountExact, charge.amount) -
    toAccountingUnits(charge.amountReceivedExact, charge.amountReceived)
  return remaining > 0n ? remaining : 0n
}

function accountingToTokenUnits(remaining: bigint, decimals: number): bigint {
  const scale = 10n ** BigInt(ACCOUNTING_DECIMALS - decimals)
  return (remaining + scale - 1n) / scale
}

export function remainingAmount(charge: Pick<Charge, 'amount' | 'amountReceived'>): number {
  const remaining = charge.amount - (charge.amountReceived ?? 0)
  return remaining > 0 ? remaining : 0
}

export function remainingAmountUnits(
  charge: RemainingAmountInput,
  decimals: number = TOKEN_DECIMALS,
): bigint {
  return accountingToTokenUnits(remainingAccountingUnits(charge), decimals)
}

export function resolvePaymentOptions(charge: Charge): PaymentOption[] {
  const remaining = remainingAccountingUnits(charge)
  if (remaining <= 0n) return []

  return charge.acceptedPayments.map((pair) => {
    const deployment = getTokenDeployment(pair.token, pair.network, charge.environment)
    return {
      ...pair,
      chainId: isEvmNetwork(pair.network)
        ? (CHAIN_IDS[pair.network][charge.environment] ?? null)
        : null,
      contractAddress: deployment?.address ?? null,
      amountUnits: accountingToTokenUnits(
        remaining,
        deployment?.decimals ?? TOKEN_DECIMALS,
      ).toString(),
    }
  })
}
