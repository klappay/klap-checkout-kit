# Webhooks

`verifyWebhookSignature()`/`constructWebhookEvent()` (node subpath)
are re-exported straight from `@klappay/node` — this package already
depends on it, and it already ships a correct, tested implementation of
Core's `X-Klappay-Signature` scheme. No second hand-rolled HMAC check
here; reuse before writing, same rule this package follows everywhere
else.

Webhooks are an alternative/complement to polling `getCheckoutPayload()`
or streaming `watchCheckout()` — set one up on Core if you want push
notifications straight to your backend instead of (or alongside) either.

## Verifying and parsing an inbound webhook

**Always verify the signature before trusting a webhook payload** —
anyone who can reach your endpoint can send a structurally-valid
request otherwise.

```ts
import { constructWebhookEvent, WebhookTimestampToleranceError } from '@klappay/checkout-kit/node'

app.post('/webhooks/klap', (req, res) => {
  try {
    const event = constructWebhookEvent(
      req.rawBody, // the raw, unparsed request body string — not req.body
      req.headers['x-klappay-signature'],
      process.env.KLAP_WEBHOOK_SECRET!,
    )

    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge
    }

    res.sendStatus(200)
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) {
      // validly signed, but too old — likely a replay of a captured delivery
      res.sendStatus(400)
      return
    }
    // InvalidWebhookSignatureError — reject, don't process
    res.sendStatus(400)
  }
})
```

`constructWebhookEvent(rawBody, signatureHeader, secret, options?)`
verifies the HMAC-SHA256 signature with a timing-safe comparison, checks
the delivery is recent (`options.toleranceSeconds`, default 300), and
parses the body — throwing `InvalidWebhookSignatureError` if the HMAC
doesn't match, or `WebhookTimestampToleranceError` if the signature is
valid but the timestamp is outside the tolerance window (a strong
signal of a replayed delivery). If you only want the boolean check
without parsing:

```ts
import { verifyWebhookSignature } from '@klappay/checkout-kit/node'

const isValid = verifyWebhookSignature(rawBody, signatureHeader, secret)
```

**Getting the raw body**: most Node frameworks parse the request body
into an object before your handler runs, which is too late for
signature verification (the signature is computed over the exact raw
bytes). Make sure your framework gives you the raw string — e.g. in
Express, use `express.raw({ type: 'application/json' })` (not
`express.json()`) on this specific route, or capture the raw body in
middleware before the JSON parser runs.

## Signing and replay protection

The signature header is `t=<unix timestamp>,v1=<hmac>` — the HMAC
covers `${timestamp}.${rawBody}`, not just the body, which is what lets
`constructWebhookEvent` reject a delivery that's validly signed but
old. The tolerance window is a mitigation, not a guarantee — a replay
sent *within* the window still passes. For belt-and-suspenders
protection, deduplicate by the payload's own `id` (unique per delivery)
on your side, especially for a handler whose effect isn't naturally
idempotent.

Registering a webhook, rotating its secret, and everything else about
managing webhooks (not just verifying deliveries) is a
`@klappay/node`/Core API concern outside this package's scope — see
`@klappay/node`'s own docs for `klap.webhooks.create()` and friends.
