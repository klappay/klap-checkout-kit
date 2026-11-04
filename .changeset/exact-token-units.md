---
'@klappay/checkout-kit': patch
---

Fixes `amountUnits` on 18-decimal tokens (BNB Chain's USDC/USDT), where floating-point noise could ask a wallet for slightly less than the charge amount (`49.9` became `49899999999999998579`) and leave the charge open. `resolvePaymentOptions()` and `remainingAmountUnits()` now compute from `amountExact`/`amountReceivedExact` when present and round up to the token's scale; `remainingAmountUnits()` takes an optional `decimals` argument. `toTokenUnits()` no longer leaks that noise either, and reads a `number` at up to 6 decimals, Core's amount precision.
