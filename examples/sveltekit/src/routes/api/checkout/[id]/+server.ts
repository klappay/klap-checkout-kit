import { KlapApiError } from '@klappay/node'
import { json } from '@sveltejs/kit'
import { checkout } from '$lib/server/checkout-kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
  try {
    const payload = await checkout.getCheckoutPayload(params.id)
    return json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return json({ error: 'charge not found' }, { status: 404 })
    }
    throw err
  }
}
