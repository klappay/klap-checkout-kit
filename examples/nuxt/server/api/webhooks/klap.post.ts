import {
  constructWebhookEvent,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event)
  const signature = getHeader(event, 'x-klappay-signature')

  if (!rawBody || !signature) {
    throw createError({ statusCode: 400, statusMessage: 'Missing signature' })
  }

  try {
    const webhookEvent = constructWebhookEvent(rawBody, signature, process.env.KLAP_WEBHOOK_SECRET!)
    if (webhookEvent.event.startsWith('charge.')) {
      // webhookEvent.data is a fully-typed Charge
    }
    return { received: true }
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) {
      throw createError({ statusCode: 400, statusMessage: 'Stale delivery' })
    }
    if (err instanceof InvalidWebhookSignatureError) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid signature' })
    }
    throw err
  }
})
