import { createClient } from '@klappay/node'
import type { CreateClientOptions, KlapClient } from '@klappay/node'
import type { Charge, CheckChargeRequest, CreateSwapQuoteInput, SwapQuote } from '@klappay/types'
import type { CheckedCheckoutPayload, CheckoutEvent, CheckoutPayload } from '../types'
import { watchCheckout, watchCheckoutWithProgress } from './events'
import { assertServerOnly } from './guard'
import { toCheckoutPayload } from './payload'

assertServerOnly('checkout')

export type CreateCheckoutKitOptions = CreateClientOptions | { client: KlapClient }

export { toCheckoutPayload }

export function createCheckoutKit(options: CreateCheckoutKitOptions = {}) {
  const client = 'client' in options ? options.client : createClient(options)

  return {
    client,
    async getCharge(chargeId: string): Promise<Charge> {
      return client.charges.get(chargeId)
    },
    async getCheckoutPayload(chargeId: string): Promise<CheckoutPayload> {
      const charge = await client.charges.get(chargeId)
      return toCheckoutPayload(charge)
    },
    async getSwapQuote(chargeId: string, input: CreateSwapQuoteInput): Promise<SwapQuote> {
      return client.charges.getQuote(chargeId, input)
    },
    async checkCheckout(
      chargeId: string,
      input?: CheckChargeRequest,
    ): Promise<CheckedCheckoutPayload> {
      const charge = await client.charges.check(chargeId, input)
      return {
        ...toCheckoutPayload(charge),
        transactionSender: charge.transactionSender,
        confirmationProgress: charge.confirmationProgress,
      }
    },
    watchCheckout(chargeId: string, signal?: AbortSignal): AsyncGenerator<CheckoutPayload> {
      return watchCheckout(client, chargeId, signal)
    },
    watchCheckoutWithProgress(
      chargeId: string,
      signal?: AbortSignal,
    ): AsyncGenerator<CheckoutEvent> {
      return watchCheckoutWithProgress(client, chargeId, signal)
    },
  }
}
