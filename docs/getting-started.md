# Getting started

## Install

```bash
pnpm add @klappay/checkout-kit @klappay/types
```

`@klappay/types` is a peer of `@klappay/checkout-kit`, installed mostly
so the type-checker can resolve it — for everyday use, every type this
package's API surface needs (`Charge`/`ChargeStatus`/`Network`/`Token`
included) is importable straight from `@klappay/checkout-kit` itself,
see [Importing types](/node#importing-types).

## Requirements

`exports` in `package.json` only declares `types`/`import` conditions —
ESM only, no `require`. If your `tsconfig.json` has
`"moduleResolution": "node"` (the default below TypeScript 5, and still
common), subpath imports like `@klappay/checkout-kit/node` fail to
resolve with:

```
Cannot find module '@klappay/checkout-kit/node' or its corresponding type declarations.
```

Fix it by setting `"moduleResolution"` to `"bundler"`, `"node16"`, or
`"nodenext"` — any of the three resolve `exports` maps correctly:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

## Two subpaths, one package

```ts
import { createCheckoutKit } from '@klappay/checkout-kit/node' // holds your API key — backend only
import { createWalletPayment } from '@klappay/checkout-kit/client' // talks to window.ethereum — browser only
```

`/node` throws immediately if it's ever evaluated where `window` is
defined — importing it into a browser bundle by mistake fails loudly at
import time instead of silently shipping your API key to every payer.
`/client` never touches an API key or does a network call to Core at
all; everything it needs is already in the `CheckoutPayload` your own
backend handed it.

## Your first checkout payload

On your own backend, wrap your Klappay API key once:

```ts
import { createCheckoutKit } from '@klappay/checkout-kit/node'

const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_API_BASE_URL!,
})
```

Then expose whatever route your frontend calls to build its UI:

```ts
import { KlapApiError } from '@klappay/node'

app.get('/api/checkout/:id', async (c) => {
  try {
    const payload = await checkout.getCheckoutPayload(c.req.param('id'))
    return c.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return c.json({ error: 'charge not found' }, 404)
    }
    throw err
  }
})
```

A nonexistent/deleted `chargeId` makes the underlying `@klappay/node`
call reject with `KlapApiError` (`status`/`code`/`message`, from
`@klappay/node` directly — not re-exported from this package since it's
already a dependency you can import yourself).

`payload` is a `CheckoutPayload` — a curated, JSON-safe subset of the
raw `Charge` (no `apiKeyId`/`metadata`/other merchant bookkeeping),
plus one `PaymentOption` per accepted `(token, network)` pair with the
exact `amountUnits` a wallet needs to send. See [Node](/node) for
every field.

## Your first wallet payment

In the browser, once you have `payload` from the route above:

```ts
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'

const [option] = payload.paymentOptions.filter(isWalletPayable)
const wallet = createWalletPayment(option, payload.address)

wallet.on('sent', (txHash) => console.log('sent', txHash))
await wallet.connect()
await wallet.pay()
```

That's a full connect → sign → send flow against whatever EIP-1193
wallet the payer has installed — no ethers.js/viem, no ABI file, just a
hand-encoded `transfer(address,uint256)` call. See [Client](/client)
for reconnecting on reload, QR fallback, and watching live status.

## Where to go next

- [`node.md`](./node) — `createCheckoutKit`, `getCheckoutPayload`, the
  `CheckoutPayload`/`PaymentOption` shape, importing types, and the
  lower-level pieces it's built from if you want a different response
  shape.
- [`client.md`](./client) — the wallet controller, QR/manual-address
  fallback, tracking "confirming" across a reload, watching live
  status, and redirecting the payer back after confirmation.
- [`checkout-flow.md`](./checkout-flow) — the whole thing end to end,
  Node and client wired together in one page.
- [`webhooks.md`](./webhooks) — verifying Core's signed webhook
  deliveries as an alternative/complement to polling.

## For LLMs and agents

This site (built from these same files with VitePress) publishes
[`llms.txt`](/llms.txt) — a link index of every doc page — and
[`llms-full.txt`](/llms-full.txt) — the full content of every doc page
concatenated into one plain-text file. Point an agent, RAG pipeline, or
MCP server at either as a lightweight way to give it the whole
package's documentation without scraping HTML. Both regenerate on every
deploy, so they never drift from what's on this page.
