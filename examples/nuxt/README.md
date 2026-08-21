# klap-checkout-kit — Nuxt example

A standalone, runnable example of a custom Klappay checkout built with
[Nuxt](https://nuxt.com) — Nitro server routes for the `/node` half
(fetching and shaping a `Charge`, streaming live status over SSE,
verifying inbound webhooks) and a Vue page + composable for the
`/client` half (connecting an injected wallet, tracking "confirming"
state across a reload, watching live status, redirecting on
confirmation).

This app is standalone — it is not part of a pnpm workspace, and
depends on the real, published `@klappay/checkout-kit` package from
npm (see "Testing against local unpublished changes" below to point it
at this repo's own build instead).

## What's here

- `server/utils/checkout-kit.ts` — the server-only `checkout` instance
  (`createCheckoutKit`), auto-imported into every Nitro route below.
- `server/api/checkout/[id].get.ts` — fetches and shapes a `Charge`
  into a `CheckoutPayload`, 404s cleanly via `KlapApiError`.
- `server/api/checkout/[id]/events.get.ts` — SSE endpoint, wired to
  `checkout.watchCheckout()` via h3's `createEventStream()`, aborted
  when the client disconnects.
- `server/api/webhooks/klap.post.ts` — verifies `X-Klappay-Signature`
  with `constructWebhookEvent()`.
- `server/api/checkout/[id]/quote.post.ts` — quotes a swap-to-pay via
  `checkout.getSwapQuote()`.
- `app/composables/useWalletPayment.ts` — the Vue Composition API
  wallet controller wrapper (`ref`/`onUnmounted`), from this package's
  own docs (`docs/frameworks.md`).
- `app/components/WalletPaymentButton.vue` — connect/pay button for one
  wallet-payable `PaymentOption`, using the composable above.
- `app/composables/useSwapPayment.ts` — the swap-to-pay equivalent:
  fetches a quote from the route above, then wraps `createSwapPayment`.
- `app/components/SwapPaymentButton.vue` — pay button for one
  `payload.swapAlternatives` entry, using the composable above.
- `app/pages/checkout/[id].vue` — the checkout page: fetches the
  payload, renders every payment option (wallet button for
  wallet-payable ones, a raw address for the rest, a swap button per
  swap alternative), watches live status over SSE, and redirects on
  confirmation.
- `app/pages/index.vue` — a minimal home page with a form to jump to
  `/checkout/<charge-id>`.

## Prerequisites

- Node 24+
- A Klappay API key and base URL from your Klappay dashboard

## Run it

```bash
pnpm install
KLAP_API_KEY=your_api_key KLAP_BASE_URL=your_base_url pnpm dev
```

Then open `http://localhost:3000` and enter a real charge id from your
own dashboard, or go straight to
`http://localhost:3000/checkout/<your-charge-id>`.

The app boots fine even without `KLAP_API_KEY`/`KLAP_BASE_URL` set
(credential resolution is lazy) — you'll just get a clean error from
`/api/checkout/:id` instead of a page of payment options until you set
them. `pnpm build` also doesn't need them: server route code only
touches `process.env` at request time, not at build time.

To verify webhook deliveries, also set `KLAP_WEBHOOK_SECRET` and point
a Klappay webhook at `POST /api/webhooks/klap`.

## Testing against local unpublished changes

By default this example depends on `@klappay/checkout-kit@latest` from
npm, so it doubles as a live smoke test of whatever is actually
published. To test against changes made in this repo instead:

```bash
# from the repo root
pnpm build

# from this folder
cd examples/nuxt
pnpm link ../../
```

When you're done, restore the real published version before
committing anything in this folder:

```bash
pnpm unlink @klappay/checkout-kit
pnpm install
```
