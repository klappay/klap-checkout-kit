import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { KlapApiError, MissingBaseUrlError, MissingCredentialError } from '@klappay/node'
import {
  constructWebhookEvent,
  createCheckoutKit,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

// Reads KLAP_API_KEY / KLAP_BASE_URL lazily on first request — this call
// never throws even when both env vars are unset (see docs/node.md).
const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})

const app = new Hono()

// The prebuilt IIFE bundle, served straight from node_modules — always
// matches whatever version of the package is actually installed, no
// copying into ./public.
app.use(
  '/vendor/checkout-kit/*',
  serveStatic({
    root: './node_modules/@klappay/checkout-kit/dist/client',
    rewriteRequestPath: (path) => path.replace(/^\/vendor\/checkout-kit/, ''),
  }),
)

app.get('/api/checkout/:id', async (c) => {
  try {
    const payload = await checkout.getCheckoutPayload(c.req.param('id'))
    return c.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return c.json({ error: 'charge not found' }, 404)
    }
    // Credential resolution is lazy — createCheckoutKit() itself never
    // throws for a missing KLAP_API_KEY/KLAP_BASE_URL, only the first
    // request that actually needs them does.
    if (err instanceof MissingCredentialError || err instanceof MissingBaseUrlError) {
      return c.json({ error: err.message }, 500)
    }
    throw err
  }
})

app.get('/api/checkout/:id/events', (c) => {
  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    stream.onAbort(() => controller.abort())

    for await (const payload of checkout.watchCheckout(c.req.param('id'), controller.signal)) {
      await stream.writeSSE({ event: 'charge', data: JSON.stringify(payload) })
    }
  })
})

app.post('/webhooks/klap', async (c) => {
  const rawBody = await c.req.text()
  const signature = c.req.header('x-klappay-signature')
  if (!signature) return c.text('Missing signature', 400)

  try {
    const event = constructWebhookEvent(rawBody, signature, process.env.KLAP_WEBHOOK_SECRET!)
    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge — wire up order fulfillment, etc. here.
    }
    return c.text('ok', 200)
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) return c.text('stale delivery', 400)
    if (err instanceof InvalidWebhookSignatureError) return c.text('invalid signature', 400)
    throw err
  }
})

app.use('/*', serveStatic({ root: './public' }))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`klap-checkout-kit hono example listening on http://localhost:${info.port}`)
})
