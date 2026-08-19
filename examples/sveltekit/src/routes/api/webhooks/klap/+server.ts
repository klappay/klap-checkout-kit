import {
  constructWebhookEvent,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'
import { text } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text()
  const signature = request.headers.get('x-klappay-signature')
  if (!signature) return text('Missing signature', { status: 400 })

  try {
    const event = constructWebhookEvent(rawBody, signature, env.KLAP_WEBHOOK_SECRET!)
    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge
    }
    return text('ok', { status: 200 })
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) return text('stale delivery', { status: 400 })
    if (err instanceof InvalidWebhookSignatureError) return text('invalid signature', { status: 400 })
    throw err
  }
}
