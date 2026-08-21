# @klappay/checkout-kit

## 1.2.0

### Minor Changes

- 3e26157: Adds swap-to-pay: letting a payer settle a charge with a crypto it doesn't
  actually accept (ETH/BNB/MATIC/AVAX/BTC), swapped via 0x into whatever
  stablecoin the charge does accept.

  - `CheckoutPayload.swapAlternatives: SwapAlternative[]` — which
    `(token, network)` pairs are offerable this way for a given charge
    (always empty for `test`-environment charges, since 0x has no testnet
    support).
  - `createCheckoutKit().getSwapQuote(chargeId, input)` (node) — a thin
    proxy to `@klappay/node`'s `client.charges.getQuote()`, returning a
    stateless `SwapQuote`.
  - `createSwapPayment(quote, provider?)` (client) — executes a
    `SwapQuote` against an injected EIP-1193 wallet: signs and appends a
    Permit2 allowance if the quote needs one (approving it on-chain first
    if the wallet hasn't already), then submits the swap transaction.
    Built directly from 0x's own documented Permit2 guide, not ported
    from an existing reference.

  Bumps `@klappay/node` to `^3.2.0` and `@klappay/types` to `^3.0.2`,
  both required for the new `getQuote()`/`SwapQuote`/`swapAlternatives`
  surface.

  Backward compatible — `CheckoutPayload` only gains a new field, every
  existing export keeps its previous signature.

### Patch Changes

- d0a8c81: Bumps `@klappay/node` to `^3.2.1` and `@klappay/types` to `^3.1.0`, and
  switches every hand-duplicated network/token constant to import from
  the new canonical sources those versions introduced:
  `src/node/wallet-payment.ts` now imports `CHAIN_IDS` from
  `@klappay/types`, and `src/client/permit2.ts`/`src/client/confirming.ts`
  import `CHAIN_IDS`/`ALT_TOKEN_ADDRESSES`/`ALT_TOKEN_DECIMALS`/
  `NETWORK_EXPLORERS` from the new zero-zod `@klappay/types/constants`
  subpath instead of their own local copies.

  No behavior change and no public API change — these constants were
  never exported from this package. `/client`'s IIFE bundle size is
  unaffected (measured before/after: same ~7.3KB).

## 1.1.0

### Minor Changes

- 6e91c7d: `createCheckoutKit()`'s `apiKey`/`baseUrl` are now optional, and the
  whole `options` argument defaults to `{}` — `createCheckoutKit()` with
  no arguments is now valid. This forwards straight into `@klappay/node`
  (bumped to `^3.1.0`), which as of that version falls back to
  `process.env.KLAP_API_KEY`/`process.env.KLAP_BASE_URL` for whichever
  field is omitted, an explicit argument always winning over its env var.
  `CreateCheckoutKitOptions` now reuses `@klappay/node`'s own
  `CreateClientOptions` type instead of a hand-duplicated `{ apiKey:
string; baseUrl: string }` shape.

  Backward compatible — every existing `createCheckoutKit({ apiKey,
baseUrl })` call site behaves identically.
