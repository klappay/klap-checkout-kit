import type { KlapClient } from '@klappay/node'
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
