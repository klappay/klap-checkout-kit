import { KlapApiError } from '@klappay/node'
import type { CheckChargeRequest } from '@klappay/checkout-kit/node'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing charge id' })
  }
  const input = await readBody<CheckChargeRequest>(event).catch(() => undefined)

  try {
    return await checkout.checkCheckout(id, input)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 404) {
        throw createError({ statusCode: 404, statusMessage: 'Charge not found' })
      }
      if (err.status === 422 || err.status === 429 || err.status === 503) {
        throw createError({ statusCode: err.status, statusMessage: err.message })
      }
    }
    throw err
  }
})
