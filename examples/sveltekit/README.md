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
- `src/routes/api/checkout/[id]/check/+server.ts` — a `POST` route
  triggering an instant on-chain re-check via `checkout.checkCheckout(id,
  input)`, called right after a wallet transaction is sent instead of
  waiting out the ~60s background reconciliation pass.
- `src/lib/wallet-store.ts` — a `svelte/store`-based wallet controller
  wrapping `createWalletPayment`, optionally taking an already-obtained
  provider (used by the WalletConnect store below) as a fourth argument.
- `src/lib/walletconnect-store.ts` — a `svelte/store`-based controller
  wrapping `createWalletConnectProvider`
  (`@klappay/checkout-kit/client/walletconnect`) — for a payer with a
  wallet app instead of a browser extension. Exposes the pairing URI as
  a store so the UI can render it (plain text here — bring your own QR
  library for anything fancier); once connected, its resolved provider
  is handed to `wallet-store.ts` above, so paying works identically to
  the injected-wallet flow. `disconnect()` tears the WalletConnect
  session down and resets the store back to its initial state, wired to
  a "Disconnect" button once connected.
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
  redirects the payer once the charge is `confirmed`. On mount it also
  calls `discoverProviders()` (EIP-6963) — with 0 or 1 wallet extensions
  found, the flow is unchanged; with 2+, a "Choose a wallet" picker
  (real name/icon per extension) appears before the connect button, so
  the payer isn't stuck with whichever extension last claimed
  `window.ethereum`.
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

`PUBLIC_WALLETCONNECT_PROJECT_ID` is only needed for the "Pay with
WalletConnect" section — register a free one at
[cloud.reown.com](https://cloud.reown.com). Left unset, that button still
renders but `connect()` will fail; the rest of the checkout is unaffected.

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
