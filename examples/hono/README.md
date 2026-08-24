# klap-checkout-kit — Hono example

A standalone, runnable example of a custom Klappay checkout built with
[Hono](https://hono.dev) and **zero frontend build step** — the client
half of `@klappay/checkout-kit` is loaded with a plain `<script>` tag
(the prebuilt IIFE bundle, `dist/client/index.global.js`), the same way
Core's own hosted checkout (klap-checkout) serves its own client JS.
This is the package's core reason to exist for a merchant with no
frontend build tooling: no bundler, no JSX, no `import` resolution in
the browser — just `window.KlapCheckoutKit`.

This app is standalone — it is not part of a pnpm workspace, and
depends on the real, published `@klappay/checkout-kit` package from
npm (see "Testing against local unpublished changes" below to point it
at this repo's own build instead).

## What's here

- `src/server.ts` — a Hono app: `GET /api/checkout/:id` (fetches and
  shapes a `Charge` into a `CheckoutPayload`), `GET
  /api/checkout/:id/events` (SSE, live status), `POST
  /api/checkout/:id/quote` (swap-to-pay quotes), `POST
  /api/checkout/:id/check` (instant on-chain re-check right after a
  wallet transaction is sent), `POST /webhooks/klap` (verified webhook
  handler), a static route serving the IIFE bundle from
  `node_modules`, and a static route serving `public/`.
- `public/index.html` + `public/app.js` — the browser side: renders
  payment options, connects a wallet, tracks "confirming" state across
  a reload, watches for the terminal status over SSE, and redirects on
  confirmation.
- `public/swap.js` — swap-to-pay: one button per
  `payload.swapAlternatives` entry, requests a quote from the server
  above once the wallet is connected, then executes it with
  `createSwapPayment()`.

## No WalletConnect demo here, on purpose

`@klappay/checkout-kit/client/walletconnect` has no IIFE build — it
assumes a bundler resolves `@walletconnect/universal-provider`'s own
tree of bare-specifier imports (a real, multi-package dependency, not
something an import map can reasonably hand-list). That's the opposite
of what this example is for. See the `nextjs`/`nuxt`/`sveltekit`
examples for a working WalletConnect integration instead.

## Prerequisites

- Node 24+
- A Klappay API key and base URL from your Klappay dashboard

## Run it

```bash
pnpm install
KLAP_API_KEY=your_api_key KLAP_BASE_URL=your_base_url pnpm dev
```

Then open `http://localhost:3000`. It loads charge id `test-id` by
default — pass a real charge id from your own dashboard with
`http://localhost:3000/?charge=<your-charge-id>`.

The server boots fine even without `KLAP_API_KEY`/`KLAP_BASE_URL` set
(credential resolution is lazy) — you'll just get a clean error from
`/api/checkout/:id` instead of a page of payment options until you set
them.

To verify webhook deliveries, also set `KLAP_WEBHOOK_SECRET` and point
a Klappay webhook at `POST /webhooks/klap`.

## Testing against local unpublished changes

By default this example depends on `@klappay/checkout-kit@latest` from
npm, so it doubles as a live smoke test of whatever is actually
published. To test against changes made in this repo instead:

```bash
# from the repo root
pnpm build

# from this folder
cd examples/hono
pnpm link ../../
```

When you're done, restore the real published version before
committing anything in this folder:

```bash
pnpm unlink @klappay/checkout-kit
pnpm install
```
