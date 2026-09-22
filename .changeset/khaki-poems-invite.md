---
"@klappay/checkout-kit": minor
---

Bump `@klappay/node` to `^5.0.0` and `@klappay/types` to `^5.0.0`.

`CheckoutPayload` now carries `amountExact`/`amountReceivedExact` (decimal-string counterparts to `amount`/`amountReceived`, safe from the precision loss a JSON number can suffer) and `paymentUnavailable` (pauses payment instructions/fulfillment for a charge without changing its `status`) — both `null`/`false` for a charge fetched from an older Core deployment that predates them. `SwapQuote` gains matching `inputAmountExact`/`outputAmountExact`/`fees.klappayFeeExact`/`fees.zeroExFeeExact`, flowing straight through `getSwapQuote()`.

Fixes a latent bug in `resolvePaymentOptions()`: `amountUnits` used to be computed once per charge with a flat 6-decimal default, applied to every accepted `(token, network)` pair regardless of that pair's actual on-chain decimals. Not every deployment uses 6 — BNB Chain's cataloged USDC/USDT are 18 — so a charge accepting a non-6-decimal pair would tell a wallet to send the right-looking number at the wrong scale. `resolvePaymentOptions()` now looks up each pair's own deployment via `@klappay/types@4.1.0`'s `getTokenDeployment()` and computes `amountUnits` per pair, falling back to `TOKEN_DECIMALS` only when a pair has no deployment metadata. Adds `remainingAmount()` (the plain-number remaining balance, no unit conversion) as an exported building block alongside the existing `remainingAmountUnits()`/`toTokenUnits()`.

Swap-to-pay's trusted alt-token set also grew upstream (`'MATIC'` renamed to `'POL'`, plus `LINK`/`ARB`/`OP`/`CBETH` as new ERC-20 inputs) — this package never hardcodes the `AltToken` list, so it's available with no code change here, just the type bump.
