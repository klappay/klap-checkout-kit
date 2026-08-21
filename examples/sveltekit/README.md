# klap-checkout-kit — SvelteKit example

A standalone, runnable SvelteKit app demonstrating a full custom Klappay
crypto checkout built with `@klappay/checkout-kit`:

- `src/routes/api/checkout/[id]/+server.ts` — `GET` route that calls
  `checkout.getCheckoutPayload(id)` and shapes `KlapApiError` 404s into a
  clean JSON error response.
- `src/routes/api/checkout/[id]/events/+server.ts` — an SSE route
  streaming `checkout.watchCheckout(id, signal)` for live charge status.
- `src/routes/api/webhooks/klap/+server.ts` — a webhook route verifying
  deliveries with `constructWebhookEvent`.
- `src/routes/api/checkout/[id]/quote/+server.ts` — a `POST` route
  quoting a swap-to-pay via `checkout.getSwapQuote(id, input)`.
- `src/lib/wallet-store.ts` — a `svelte/store`-based wallet controller
  wrapping `createWalletPayment`.
- `src/lib/swap-store.ts` — a `svelte/store`-based swap-to-pay
  controller wrapping `createSwapPayment`, fetching a quote from the
  route above first.
- `src/routes/checkout/[id]/SwapAlternatives.svelte` — one button per
  `payload.swapAlternatives` entry, using the store above; mirrors
  `WalletPaymentButton.vue`/`SwapAlternatives.tsx` in the Nuxt/Next.js
  examples.
- `src/routes/checkout/[id]/+page.svelte` — the checkout UI: loads the
  charge via a `load` function, renders a wallet-connect button for
  wallet-payable options (falling back to the raw deposit address for
  anything without a chain mapping), the swap component above, tracks
  "confirming" state across a reload, watches live status over SSE, and
  redirects the payer once the charge is `confirmed`.
- `src/routes/+page.svelte` — a minimal home page linking into
  `/checkout/[id]`.

This app is not itself a hosted checkout product — it's a reference for
integrating `@klappay/checkout-kit` into your own SvelteKit app with your
own UI.

## Prerequisites

- Node 24+
- A Klappay API key and base URL (your own — this example doesn't
  invent or provide one)
- pnpm (or npm/yarn — swap the commands below accordingly)

## Running

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and fill in `KLAP_API_KEY`, `KLAP_BASE_URL`,
and (if you're testing the webhook route) `KLAP_WEBHOOK_SECRET`. These are
only read at request time (`$env/dynamic/private`), not at build time, so
`pnpm build` succeeds even without them set.

Then visit `/` and enter a real charge ID, or go straight to
`/checkout/<chargeId>`.

## Building

```bash
pnpm build
pnpm preview
```

## Testing against local unpublished changes

This example's `package.json` pins `@klappay/checkout-kit` to the
`latest` npm dist-tag, same as every other example in this repo — it's a
live smoke test of whatever is actually published. To test against a
local, unpublished build of the package instead:

```bash
# from the repo root
pnpm build

# from this folder
pnpm link ../../
```

Restore the published version before committing anything:

```bash
pnpm unlink @klappay/checkout-kit
pnpm install
```
