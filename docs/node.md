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
  baseUrl: process.env.KLAP_BASE_URL!,
})

// or, if you already built a @klappay/node client elsewhere:
const checkout = createCheckoutKit({ client: existingKlapClient })
```

`options` is `CreateCheckoutKitOptions` (also exported, for typing your
own wrapper around this call) — `CreateClientOptions` (re-exported from
`@klappay/node`, both fields optional) or `{ client }`, never both.

### Letting `@klappay/node` read `KLAP_API_KEY`/`KLAP_BASE_URL` itself

Since `@klappay/node@3.1`, `createClient()` falls back to
`process.env.KLAP_API_KEY`/`process.env.KLAP_BASE_URL` for any field
you omit — `createCheckoutKit()` passes `options` straight through, so
that fallback works here too. With both env vars set, this is
equivalent to the explicit call above:

```ts
const checkout = createCheckoutKit() // reads KLAP_API_KEY / KLAP_BASE_URL
```

Nothing is validated eagerly — an omitted `apiKey`/`baseUrl` with no
matching env var set doesn't throw until the first actual request
(`MissingCredentialError`/`MissingBaseUrlError`, both from
`@klappay/node`), same as passing them explicitly. An explicit argument
always wins over its env var. `createCheckoutKit()` only ever touches
`client.charges`, which also accepts its own, more specific
`KLAP_CHARGES_API_KEY` as a fallback below `KLAP_API_KEY` — handy if
your charges key is scoped narrower than the rest of your Klappay
integration. See `@klappay/node`'s own docs if you're reaching for
`checkout.client` directly and want the full per-resource env var list.

Returns:

- `getCheckoutPayload(chargeId)` — fetch the charge and shape it into
  a `CheckoutPayload`, the 80%-case one-call path.
- `getCharge(chargeId)` — the full raw `Charge`, if you want to build
  your own response shape (see "Composing your own shape" below).
- `getSwapQuote(chargeId, input)` — quote a swap-to-pay, see
  [Swap-to-pay](#swap-to-pay-paying-with-a-different-crypto) below.
- `checkCheckout(chargeId, input?)` — trigger an immediate on-chain
  re-check instead of waiting for background reconciliation, see
  [Instant re-check](#instant-re-check-after-a-payers-transaction) below.
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
  "swapAlternatives": [],
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
`swapAlternatives` is empty here because this is a `test`-environment
charge — 0x (who powers swap-to-pay) has no testnet support, so it's
always empty for `test`, populated only for `live` (see
[Swap-to-pay](#swap-to-pay-paying-with-a-different-crypto)).

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
  swapAlternatives: SwapAlternative[]
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
  AltToken,
  Charge,
  CheckChargeRequest,
  ChargeStatus,
  CreateSwapQuoteInput,
  Environment,
  Network,
  SettlementStatus,
  SwapAlternative,
  SwapQuote,
  Token,
} from '@klappay/checkout-kit/node' // or /client
```

`CheckoutPayload` and `PaymentOption` are this package's own types —
defined in `src/types.ts`, shared by both subpaths. Everything else in
that second import (`AcceptedPayment`, `AltToken`, `Charge`,
`ChargeStatus`, `CheckChargeRequest`, `CreateSwapQuoteInput`,
`Environment`, `Network`, `SettlementStatus`, `SwapAlternative`,
`SwapQuote`, `Token`) is re-exported straight from `@klappay/types`,
purely for convenience —
same types, same values at runtime, just reachable without a second
package import.
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

## Swap-to-pay: paying with a different crypto

A charge only ever accepts specific `(token, network)` pairs
(`payload.paymentOptions`) — swap-to-pay lets a payer settle it with a
crypto it doesn't actually accept instead (ETH, BNB, MATIC, AVAX, or
BTC), swapped via 0x into one of the accepted pairs before it ever
reaches you. You always receive the stablecoin you configured; the
payer covers the swap.

`payload.swapAlternatives` lists which `(token, network)` pairs are
offerable this way for this charge — empty for a `test`-environment
charge (0x has no testnet), or if swap-to-pay isn't configured on your
deployment:

```ts
type SwapAlternative = { token: AltToken; network: Network } // AltToken: 'ETH' | 'BNB' | 'MATIC' | 'AVAX' | 'BTC'
```

Once the payer picks one, request a quote from your own backend —
`getSwapQuote()` needs the payer's connected wallet address as
`takerAddress`, so this can't happen before `client/swap.ts`'s
`connect()` on the frontend:

```ts
app.post('/api/checkout/:id/quote', async (c) => {
  const { inputToken, inputNetwork, takerAddress } = await c.req.json()
  return c.json(await checkout.getSwapQuote(c.req.param('id'), { inputToken, inputNetwork, takerAddress }))
})
```

`getSwapQuote(chargeId, input)` proxies `@klappay/node`'s
`client.charges.getQuote()` — a stateless, on-demand computation, not a
persisted resource; there's no `quoteId` to look up later, just
re-request if the payer waits too long. `SwapQuote`:

```ts
type SwapQuote = {
  inputToken: AltToken
  inputNetwork: Network
  inputAmount: number // ceiling the payer needs available, in whole units — a favorable price refunds the excess automatically, on-chain, same transaction
  outputToken: Token
  outputNetwork: Network
  outputAmount: number // exactly what you receive — charge.amount - charge.amountReceived, never reduced by fees below
  fees: { klappayFee: number; zeroExFee: number | null } // both paid by the payer on top of inputAmount, already reflected in it — shown separately for transparency
  expiresAt: string // ~30s UI countdown hint only — the real price guarantee is on-chain, not this timestamp
  transaction: { to: string; data: string; value: string }
  permit2?: { eip712: Record<string, unknown> } // present only for an ERC-20 input (today, only BTC)
}
```

Hand the quote straight to `createSwapPayment()` on the client —
see [Swap-to-pay](/client#swap-to-pay-paying-with-a-different-crypto)
for the wallet-signing side, including why an ERC-20 input (`BTC`)
needs one extra on-chain approval step a native-currency input (ETH/
BNB/MATIC/AVAX) doesn't.

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

## Instant re-check after a payer's transaction

Background reconciliation catches a new on-chain payment within roughly
a minute as a backstop — fine for a payer who just scanned a QR code
and is waiting anyway, too slow right after `createWalletPayment()` or
`createSwapPayment()` sends a transaction from a connected wallet, where
you already know a transaction went out. `checkCheckout(chargeId,
input?)` proxies `@klappay/node`'s `client.charges.check()`, requiring
the same API key as everything else in `createCheckoutKit()` — wire it
into your own route next to `watchCheckout()`'s:

```ts
app.post('/api/checkout/:id/check', async (c) => {
  const { txHash, network } = await c.req.json()
  return c.json(await checkout.checkCheckout(c.req.param('id'), { txHash, network }))
})
```

Passing `txHash`/`network` verifies that specific transaction directly
— one RPC call instead of a block-range scan — but the amount credited
always comes from what that transaction actually contains on-chain,
never from anything the caller claims. Omit both to re-run the same
block-range scan reconciliation uses. Either way this never trusts the
caller: the charge only changes state if a real matching transfer is
found. Core rate-limits this to once every 10 seconds per charge (shared
across every caller, not per API key) since each call costs a real RPC
round trip — a `429` from `client.charges.check()` means someone
already triggered a check recently; prefer `watchCheckout()` to observe
the result instead of polling this repeatedly.

The returned payload also carries `transactionSender` — the checked
transaction's own signer, which stays the payer's real wallet even
when the payment routed through a swap/aggregator, unlike the credited
transfer's own sender. `null` when no matching receipt was found.

## Verifying webhooks

`verifyWebhookSignature()`/`constructWebhookEvent()` are re-exported
from `@klappay/node` — see [Webhooks](/webhooks).
