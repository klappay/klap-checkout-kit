import type { Charge } from '@klappay/types'
import type { CheckoutPayload } from '../types'
import { resolvePaymentOptions } from './wallet-payment'

export function toCheckoutPayload(charge: Charge): CheckoutPayload {
  return {
    id: charge.id,
    status: charge.status,
    settlementStatus: charge.settlementStatus,
    amount: charge.amount,
    amountExact: charge.amountExact ?? null,
    feePayer: charge.feePayer,
    feePercent: charge.feePercent,
    feeAmount: charge.feeAmount,
    merchantAmount: charge.merchantAmount,
    amountReceived: charge.amountReceived,
    amountReceivedExact: charge.amountReceivedExact ?? null,
    isOverpaid: charge.isOverpaid,
    paymentUnavailable: charge.paymentUnavailable ?? false,
    currency: charge.currency,
    environment: charge.environment,
    address: charge.address,
    expiresAt: charge.expiresAt,
    redirectUrl: charge.redirectUrl,
    paidWith: charge.paidWith,
    paymentOptions: resolvePaymentOptions(charge),
    swapAlternatives: charge.swapAlternatives,
  }
}
