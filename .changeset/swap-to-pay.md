---
"@klappay/checkout-kit": minor
---

Adds swap-to-pay: letting a payer settle a charge with a crypto it doesn't
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
