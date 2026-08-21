import { createClient } from '@klappay/node'
import type { CreateClientOptions, KlapClient } from '@klappay/node'
import type { Charge, CreateSwapQuoteInput, SwapQuote } from '@klappay/types'
import type { CheckoutPayload } from '../types'
import { watchCheckout } from './events'
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
    watchCheckout(chargeId: string, signal?: AbortSignal): AsyncGenerator<CheckoutPayload> {
      return watchCheckout(client, chargeId, signal)
    },
  }
}
