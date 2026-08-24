# klap-checkout-kit — Next.js example

A runnable Next.js 15 App Router app demonstrating a full custom Klappay
crypto checkout built on `@klappay/checkout-kit`:

- `app/api/checkout/[id]/route.ts` — fetches a charge and shapes it into a
  `CheckoutPayload` via `checkout.getCheckoutPayload()`.
- `app/api/checkout/[id]/events/route.ts` — proxies Core's live charge
  status over SSE via `checkout.watchCheckout()`.
- `app/api/webhooks/klap/route.ts` — verifies and parses inbound Klappay
  webhook deliveries via `constructWebhookEvent()`.
- `app/api/checkout/[id]/quote/route.ts` — quotes a swap-to-pay via
  `checkout.getSwapQuote()`.
- `app/api/checkout/[id]/check/route.ts` — triggers an immediate on-chain
  re-check via `checkout.checkCheckout()`, instead of waiting out the
  ~60s background reconciliation pass. Called right after a wallet
  transaction is sent (both `hooks.ts` and `swap-hooks.ts`).
- `app/checkout/[id]/` — a checkout page: connect a wallet, pay, watch live
  status, fall back to a manual address for pairs with no wallet mapping,
  survive a reload mid-confirmation, and redirect once the charge is
  confirmed. `swap-hooks.ts` + `SwapAlternatives.tsx` add swap-to-pay —
  one button per `payload.swapAlternatives` entry. `walletconnect-hooks.ts`
  adds an alternative "Pay with WalletConnect" flow, for a payer with a
  wallet app instead of a browser extension (see "WalletConnect" below).

See [`docs/checkout-flow.md`](https://github.com/klappay/klap-checkout-kit/blob/main/docs/checkout-flow.md)
in the main package for the full walkthrough this app implements.

## Prerequisites

- Node.js 24+
- A Klappay API key and base URL (from your own Klappay account — this
  README doesn't invent one)
- An existing charge id to test against (create one with `@klappay/node`'s
  `klap.charges.create()`, see `docs/checkout-flow.md`)

## Running it

```bash
pnpm install
```

Set the required environment variables (e.g. in `.env.local`):

```
KLAP_API_KEY=your-api-key
KLAP_BASE_URL=your-base-url
KLAP_WEBHOOK_SECRET=your-webhook-secret
```

Optionally, to see the "Pay with WalletConnect" button (payer has a
wallet app, not a browser extension), also set:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-reown-cloud-project-id
```

Register a free project id at [cloud.reown.com](https://cloud.reown.com) —
without it, that button is simply hidden and only the injected-wallet flow
shows.

Then:

```bash
pnpm dev
```

Visit `http://localhost:3000`, or go straight to
`http://localhost:3000/checkout/<your-charge-id>`.

## Testing against local unpublished changes

This example's `package.json` pins `@klappay/checkout-kit` to the `latest`
npm dist-tag on purpose, so it always tracks whatever's actually published —
doubling as a live smoke test of the real package. To test against local,
unpublished changes to the package instead:

1. Build the package first, from the repo root:

   ```bash
   pnpm build
   ```

2. From this folder, link the local build in place of the npm package:

   ```bash
   pnpm link ../../
   ```

3. When you're done, restore the published version before committing
   anything in this folder:

   ```bash
   pnpm unlink @klappay/checkout-kit && pnpm install
   ```
