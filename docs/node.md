# Node

`@klappay/checkout-kit/node` holds your API key — never import this
subpath into a browser bundle (it throws immediately if `window` is
defined, so the mistake fails loudly instead of silently shipping a
secret). Named for the runtime it requires, not a role — this same code
runs equally in a serverless function, a long-running server, or a CLI
script, anywhere Node and an API-key secret can live.

## `createCheckoutKit(options)`

```ts
import { createCheckoutKit } from '@klappay/checkout-kit/node'

const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_API_BASE_URL!,
})

// or, if you already built a @klappay/node client elsewhere:
const checkout = createCheckoutKit({ client: existingKlapClient })
```

`options` is `CreateCheckoutKitOptions` (also exported, for typing your
own wrapper around this call) — either `{ apiKey, baseUrl }` or
`{ client }`, never both.

Returns:

- `getCheckoutPayload(chargeId)` — fetch the charge and shape it into
  a `CheckoutPayload`, the 80%-case one-call path.
- `getCharge(chargeId)` — the full raw `Charge`, if you want to build
  your own response shape (see "Composing your own shape" below).
- `watchCheckout(chargeId, signal?)` — an `AsyncGenerator<CheckoutPayload>`
  for live status, see [Full checkout flow](/checkout-flow).
- `client` — the underlying `@klappay/node` client, for anything this
  package doesn't wrap (webhook management, metrics, etc.).

## The `CheckoutPayload` shape

A real `getCheckoutPayload()` response — a pending **test**-environment
charge accepting USDC on two networks, one of them (`polygon`) with no
wallet mapping yet because this package's `CHAIN_IDS` table
(`src/node/wallet-payment.ts`) only has a `live` chain ID for `polygon`,
not a `test` one:

```json
{
  "id": "ch_9f2a1c",
  "status": "pending",
  "settlementStatus": null,
  "amount": 49.9,
  "amountReceived": null,
  "isOverpaid": false,
  "currency": "USD",
  "environment": "test",
  "address": "0xAbC123...",
  "expiresAt": "2026-08-19T15:00:00.000Z",
  "redirectUrl": "https://your-store.com/orders/1234/thank-you",
  "paidWith": [],
  "paymentOptions": [
    {
      "token": "USDC",
      "network": "base",
      "chainId": 84532,
      "contractAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amountUnits": "49900000"
    },
    {
      "token": "USDC",
      "network": "polygon",
      "chainId": null,
      "contractAddress": null,
      "amountUnits": "49900000"
    }
  ]
}
```

The `polygon` entry is still fully payable — just not by wallet
(`isWalletPayable()` returns `false` for it); render `payload.address`
directly for that pair instead of a wallet-connect button.

The type behind that shape:

```ts
type CheckoutPayload = {
  id: string
  status: ChargeStatus // 'pending' | 'partially_paid' | 'confirmed' | 'expired' | 'underpaid'
  settlementStatus: SettlementStatus | null
  amount: number
  amountReceived: number | null
  isOverpaid: boolean
  currency: string
  environment: Environment // 'live' | 'test'
  address: string
  expiresAt: string
  redirectUrl: string | null
  paidWith: AcceptedPayment[]
  paymentOptions: PaymentOption[]
}

type PaymentOption = AcceptedPayment & {
  chainId: number | null
  contractAddress: string | null
  amountUnits: string
}
```

`apiKeyId`/`externalRef`/`source`/`metadata` are deliberately left out —
that's the merchant's own bookkeeping, not something that needs to
reach a payer's browser by default. Use `getCharge()` if you need the
full raw `Charge`.

`resolveRedirectUrl(redirectUrl)` (also exported here, not just from
`/client`) validates `redirectUrl` — only `http:`/`https:` survive —
for anything you want to check or log server-side before it ever
reaches a payer's browser; see [Client](/client#redirecting-after-confirmation)
for the usual client-side usage right before `window.location.href = ...`.

`paymentOptions` has one entry per `charge.acceptedPayments` pair,
always — `chainId`/`contractAddress` are `null` when this package has
no wallet chain mapping for that pair, rather than dropping it from the
array. It's still payable by QR/manual address (`payload.address`), so
hiding it entirely would make a real, still-payable option invisible to
your UI. Use `isWalletPayable(option)` to decide whether to show a
wallet-connect button for a given option:

```ts
import { isWalletPayable } from '@klappay/checkout-kit/node' // also from /client

const walletOptions = payload.paymentOptions.filter(isWalletPayable)
```

`OPEN_STATUSES`/`isOpenStatus(status)` tell you which of the five
`ChargeStatus` values are still payable — `pending` and `partially_paid`
are open; `confirmed`, `expired`, and `underpaid` are terminal.

## Importing types

Every type used in the shapes above is importable straight from this
package — no separate `@klappay/types` install needed just to type a
`payload`:

```ts
import type { CheckoutPayload, PaymentOption } from '@klappay/checkout-kit/node' // or /client

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

`CheckoutPayload` and `PaymentOption` are this package's own types —
defined in `src/types.ts`, shared by both subpaths. Everything else in
that second import (`AcceptedPayment`, `Charge`, `ChargeStatus`,
`Environment`, `Network`, `SettlementStatus`, `Token`) is re-exported
straight from `@klappay/types`, purely for convenience — same types,
same values at runtime, just reachable without a second package import.
`Charge` is the one that isn't a field type of `CheckoutPayload` itself;
it's the full raw shape `getCharge()`/`toCheckoutPayload()` take as
input, exported for when you're composing your own response shape (see
below). Install `@klappay/types` directly only if you need something
outside this list — other `@klappay/node` resources' types, the Zod
schemas themselves, etc.

## Composing your own shape

`getCheckoutPayload()` is convenience, not the only path — it's built
from smaller, independently exported pieces, so a different response
shape doesn't need a bolted-on `transform`/`select` option:

```ts
import { resolvePaymentOptions, toCheckoutPayload } from '@klappay/checkout-kit/node'

const charge = await checkout.getCharge(chargeId) // full raw Charge
const options = resolvePaymentOptions(charge) // one PaymentOption per accepted pair
const payload = toCheckoutPayload(charge) // same shaping getCheckoutPayload() uses internally
```

`resolvePaymentOptions()` itself is built from two smaller exported
pieces, for anyone doing their own amount math instead of trusting
`PaymentOption.amountUnits`:

```ts
import { remainingAmountUnits, toTokenUnits } from '@klappay/checkout-kit/node'

remainingAmountUnits(charge) // charge.amount minus charge.amountReceived, as token units (bigint) — clamped to 0n, never negative
toTokenUnits(49.9) // a plain decimal amount → token units (bigint); optional 2nd arg overrides @klappay/types' TOKEN_DECIMALS default
```

## QR codes: no round-trip needed

Once `resolvePaymentOptions()` has computed `chainId`/`contractAddress`/
`amountUnits`, the EIP-681 payment URI is fully knowable — no extra
network call to Core's `/qrcode` endpoint, no extra secret-holding
round trip through your backend:

```ts
import { buildPaymentUri } from '@klappay/checkout-kit/node' // also from /client

const uri = buildPaymentUri(option, payload.address)
```

`buildPaymentUri()` throws for an option with no wallet mapping
(`chainId`/`contractAddress` both `null`) — render `payload.address`
directly for that pair instead. This package doesn't ship a QR
renderer itself; pipe the URI into whatever QR library you already use
(e.g. the `qrcode` npm package renders an SVG/canvas from any string).

## Live status: must proxy through your own backend

Core's `/v1/charges/{id}/events` (SSE) is API-key-authenticated — a
browser can never hit it directly. `watchCheckout()` wraps
`@klappay/node`'s `charges.watch()` into an `AsyncGenerator<CheckoutPayload>`
you wire into your own SSE/WS route:

```ts
import { streamSSE } from 'hono/streaming' // any framework's SSE helper works the same way

app.get('/api/checkout/:id/events', async (c) => {
  return streamSSE(c, async (stream) => {
    for await (const payload of checkout.watchCheckout(c.req.param('id'))) {
      await stream.writeSSE({ event: 'charge', data: JSON.stringify(payload) })
    }
  })
})
```

An async generator is the lowest common denominator every framework can
consume in a few lines — this package intentionally doesn't ship a
framework-specific adapter.

## Verifying webhooks

`verifyWebhookSignature()`/`constructWebhookEvent()` are re-exported
from `@klappay/node` — see [Webhooks](/webhooks).
