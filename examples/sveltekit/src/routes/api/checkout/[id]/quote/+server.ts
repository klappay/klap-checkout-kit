import { KlapApiError } from '@klappay/node'
import { json } from '@sveltejs/kit'
import { checkout } from '$lib/server/checkout-kit'
import type { CreateSwapQuoteInput } from '@klappay/checkout-kit/node'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request }) => {
  const input: CreateSwapQuoteInput = await request.json()

  try {
    const quote = await checkout.getSwapQuote(params.id, input)
    return json(quote)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 422 || err.status === 409 || err.status === 429 || err.status === 503) {
        return json({ error: err.message }, { status: err.status })
      }
    }
    throw err
  }
}
