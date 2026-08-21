import { KlapApiError } from '@klappay/node'
import type { CreateSwapQuoteInput } from '@klappay/checkout-kit/node'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing charge id' })
  }
  const input = await readBody<CreateSwapQuoteInput>(event)

  try {
    return await checkout.getSwapQuote(id, input)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 422 || err.status === 409 || err.status === 429 || err.status === 503) {
        throw createError({ statusCode: err.status, statusMessage: err.message })
      }
    }
    throw err
  }
})
