import { KlapApiError } from '@klappay/node'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing charge id' })
  }

  try {
    return await checkout.getCheckoutPayload(id)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Charge not found' })
    }
    throw err
  }
})
