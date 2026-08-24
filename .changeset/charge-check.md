---
"@klappay/checkout-kit": minor
---

Bumps `@klappay/node` to `^3.3.0` and `@klappay/types` to `^3.2.0`, and
adds `checkCheckout(chargeId, input?)` to `createCheckoutKit()`, wrapping
the new `client.charges.check()` — triggers an immediate on-chain
re-check of a charge instead of waiting out the ~60s background
reconciliation pass. Pass `txHash`/`network` (e.g. right after
`createWalletPayment()`/`createSwapPayment()` sends a transaction) to
verify that specific transaction directly instead of scanning a block
range. Rate-limited by Core to once every 10 seconds per charge; never
trusts the caller — the charge only changes state if a real matching
transfer is found on-chain. `CheckChargeRequest` is re-exported from
both `/node` and `/client` alongside the other `@klappay/types`
convenience re-exports. See "Instant re-check after a payer's
transaction" in `docs/node.md`.
