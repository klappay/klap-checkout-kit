import { KlapApiError } from '@klappay/node'
import { json } from '@sveltejs/kit'
import { checkout } from '$lib/server/checkout-kit'
import type { CheckChargeRequest } from '@klappay/checkout-kit/node'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request }) => {
  const input: CheckChargeRequest | undefined = await request.json().catch(() => undefined)

  try {
    const payload = await checkout.checkCheckout(params.id, input)
    return json(payload)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 404) return json({ error: 'charge not found' }, { status: 404 })
      if (err.status === 422 || err.status === 429 || err.status === 503) {
        return json({ error: err.message }, { status: err.status })
      }
    }
    throw err
  }
}
