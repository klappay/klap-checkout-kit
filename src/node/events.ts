import { isChargeEvent, isConfirmationProgressEvent } from '@klappay/node'
import type { KlapClient } from '@klappay/node'
import type { CheckoutEvent } from '../types'
import { assertServerOnly } from './guard'
import { toCheckoutPayload } from './payload'

assertServerOnly('events')

export async function* watchCheckout(
  client: KlapClient,
  chargeId: string,
  signal: AbortSignal = new AbortController().signal,
) {
  for await (const charge of client.charges.watch(chargeId, signal)) {
    yield toCheckoutPayload(charge)
  }
}

export async function* watchCheckoutWithProgress(
  client: KlapClient,
  chargeId: string,
  signal: AbortSignal = new AbortController().signal,
): AsyncGenerator<CheckoutEvent> {
  for await (const event of client.charges.watchEvents(chargeId, signal)) {
    if (isChargeEvent(event)) {
      yield { type: 'charge', payload: toCheckoutPayload(event.data) }
    } else if (isConfirmationProgressEvent(event)) {
      yield { type: 'confirmation_progress', progress: event.data }
    }
  }
}
