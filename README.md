<img src="./logo.png" alt="Klap" width="80" />

# @klappay/checkout-kit

Build your own Klappay checkout UI, without reimplementing the two hard
parts: turning a `Charge` into what a payment UI needs, and talking to
an injected wallet. See `CLAUDE.md` for the full rationale.

Full docs (guides + a full checkout-flow walkthrough) live in
[`docs/`](./docs) — run `pnpm docs:dev` to browse them locally until a
hosted site exists.

## Install

```bash
pnpm add @klappay/checkout-kit @klappay/types
```

## Node — your backend

```ts
import { createCheckoutKit } from '@klappay/checkout-kit/node'

const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_API_BASE_URL!,
})

// Route your frontend calls to build its own UI from:
app.get('/api/checkout/:id', async (c) => {
  const payload = await checkout.getCheckoutPayload(c.req.param('id'))
  return c.json(payload)
})

// Optional: relay live status to your own frontend (SSE shown here,
// any transport your frontend already speaks works the same way)
app.get('/api/checkout/:id/events', async (c) => {
  return streamSSE(c, async (stream) => {
    for await (const payload of checkout.watchCheckout(c.req.param('id'))) {
      await stream.writeSSE({ event: 'charge', data: JSON.stringify(payload) })
    }
  })
})
```

Want a different response shape than `getCheckoutPayload()`'s default?
Compose it yourself from the same pieces it's built from:

```ts
import { resolvePaymentOptions, toCheckoutPayload } from '@klappay/checkout-kit/node'

const charge = await checkout.getCharge(chargeId) // full raw Charge
const options = resolvePaymentOptions(charge) // one PaymentOption per accepted pair
```

## Client — your frontend

Headless — no DOM/framework assumptions, drops into React, Vue, Svelte,
or plain JS the same way. See [`docs/frameworks.md`](./docs/frameworks.md)
for hook/composable/store examples per framework, or
[`docs/examples.md`](./docs/examples.md) for complete server + client
integrations (Hono, Next.js).

```ts
import { createWalletPayment, buildPaymentUri, isWalletPayable } from '@klappay/checkout-kit/client'

// Not every accepted (token, network) pair is wallet-payable — this
// package may have no chain-id/contract mapping for one (chainId and
// contractAddress are null in that case). It's still payable by QR/
// manual address, just gate the wallet button on isWalletPayable():
const [option] = payload.paymentOptions.filter(isWalletPayable)
const wallet = createWalletPayment(option, payload.address)

wallet.on('sent', (txHash) => console.log('sent', txHash))
await wallet.connect()
await wallet.pay()

// On reload, restore an already-authorized wallet without a popup:
await wallet.reconnect()

// Or render a QR instead of using an injected wallet — no extra network
// call, everything needed is already in `payload`:
const uri = buildPaymentUri(option, payload.address)
```

Both `createWalletPayment()` and `buildPaymentUri()` throw immediately
if handed an option with no wallet mapping — filter with
`isWalletPayable()` first. For a pair that isn't wallet-payable, render
`payload.address` directly (as a static "send to this address" QR/text)
instead of calling `buildPaymentUri()` on it.

Tracking "confirming" state across a reload, before your own status
route reflects it:

```ts
import { saveConfirming, getConfirming, clearConfirming } from '@klappay/checkout-kit/client'
```

Live status from your own backend route:

```ts
import { watchCheckoutEvents } from '@klappay/checkout-kit/client'

const stop = watchCheckoutEvents(`/api/checkout/${id}/events`, (payload) => {
  // re-render with payload.status — isOpenStatus(payload.status) tells
  // you whether it's still payable ('pending'/'partially_paid') or
  // terminal ('confirmed'/'expired'/'underpaid')
})
```

Sending the payer back to your own site once payment confirms:

```ts
import { resolveRedirectUrl } from '@klappay/checkout-kit/client'

if (payload.status === 'confirmed') {
  const url = resolveRedirectUrl(payload.redirectUrl) // null unless http(s)
  if (url) window.location.href = url
}
```

`resolveRedirectUrl()` is also exported from `/node`, for validating
`redirectUrl` server-side before it ever reaches the browser.

### No bundler on the frontend? Use the script-tag build

`/client` also ships as a self-contained IIFE — everything resolved and
inlined, no `import` needed — for a frontend with no bundler at all
(plain `<script src="...">`, no build step):

```html
<script src="/vendor/klap-checkout-kit/index.global.js"></script>
<script>
  const wallet = KlapCheckoutKit.createWalletPayment(option, payload.address)
  wallet.on('sent', (txHash) => console.log('sent', txHash))
  await wallet.connect()
  await wallet.pay()
</script>
```

Every named export above (`createWalletPayment`, `buildPaymentUri`,
`isWalletPayable`, `resolveRedirectUrl`, etc.) is a property of the
`KlapCheckoutKit` global — same functions, same behavior as the ESM
import, just reachable without a bundler. Serve
`node_modules/@klappay/checkout-kit/dist/client/index.global.js`
directly (e.g. a second static-file route pointed at that path) rather
than copying it — that way it always matches whatever version is
actually installed.

## Types

Every type this package's own API surface uses is importable from
either subpath — no separate `@klappay/types` import needed just to
type a `payload` or an `option`:

```ts
import type { CheckoutPayload, PaymentOption } from '@klappay/checkout-kit/node' // or /client

// re-exported straight from @klappay/types, for typing fields of the above:
import type {
  AcceptedPayment,
  Charge,
  ChargeStatus,
  Environment,
  Network,
  SettlementStatus,
  Token,
} from '@klappay/checkout-kit/node' // or /client
```

`CheckoutPayload`/`PaymentOption` are this package's own types — the
curated shape `toCheckoutPayload()`/`resolvePaymentOptions()` produce
(see [Node](./docs/node.md) or [Client](./docs/client.md) for every
field). `Charge` is the full raw type from `@klappay/types`, useful if
you called `checkout.getCharge()` directly instead of
`getCheckoutPayload()`. `@klappay/types` itself is still worth
installing directly (`pnpm add @klappay/types`) if you need anything
outside this package's own surface — request/response types for
`@klappay/node`'s other resources, Zod schemas, etc.

## What this doesn't do

- Doesn't render any UI — pick your own framework, your own styling,
  your own QR-rendering library (e.g. the `qrcode` npm package renders
  an SVG/canvas from any string, including `buildPaymentUri()`'s output).
- Doesn't proxy Core's SSE stream for you — that must go through your
  own backend (the API key can't reach a browser), `watchCheckout()` is
  the server-side half of that relay.
- Doesn't add a public/unauthenticated charge-read surface — you need
  your own backend with your own Klappay API key, same as any
  `@klappay/node` integration.
- Doesn't support WalletConnect or any wallet that isn't an injected
  EIP-1193 provider — no `window.ethereum` (a mobile browser tab, not a
  wallet app's in-app browser) means no wallet flow; QR/manual-address
  payment still works there.
- Doesn't retry a chain switch via `wallet_addEthereumChain` if the
  wallet doesn't already have the target network configured
  (`wallet_switchEthereumChain` error `4902`) — `pay()` lets that error
  surface as-is.
- Doesn't classify wallet errors for you — `error.code === 4001` on the
  `'error'` event means the payer rejected the transaction; anything
  else is provider-specific.
- Doesn't set up a webhook endpoint for you — Core also supports signed,
  server-to-server webhooks (`charge.confirmed`, `charge.expired`, etc.)
  as an alternative/complement to polling `getCharge()`/`watchCheckout()`.
  `verifyWebhookSignature()`/`constructWebhookEvent()` (re-exported from
  `@klappay/node`, node subpath) validate the `X-Klappay-Signature`
  header on whatever route you wire up to receive them.

## License

MIT — see [`LICENSE`](./LICENSE).
