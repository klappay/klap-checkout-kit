import {
  constructWebhookEvent,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-klappay-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  try {
    const event = constructWebhookEvent(rawBody, signature, process.env.KLAP_WEBHOOK_SECRET!)
    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge — wire up order fulfillment, etc. here.
    }
    return new Response('ok', { status: 200 })
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) {
      return new Response('stale delivery', { status: 400 })
    }
    if (err instanceof InvalidWebhookSignatureError) {
      return new Response('invalid signature', { status: 400 })
    }
    throw err
  }
}
