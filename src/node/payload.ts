import type { Charge } from '@klappay/types'
import type { CheckoutPayload } from '../types'
import { resolvePaymentOptions } from './wallet-payment'

export function toCheckoutPayload(charge: Charge): CheckoutPayload {
  return {
    id: charge.id,
    status: charge.status,
    settlementStatus: charge.settlementStatus,
    amount: charge.amount,
    amountReceived: charge.amountReceived,
    isOverpaid: charge.isOverpaid,
    currency: charge.currency,
    environment: charge.environment,
    address: charge.address,
    expiresAt: charge.expiresAt,
    redirectUrl: charge.redirectUrl,
    paidWith: charge.paidWith,
    paymentOptions: resolvePaymentOptions(charge),
  }
}
