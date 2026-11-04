---
'@klappay/checkout-kit': minor
---

Bumps `@klappay/types` to `^7.0.0` and `@klappay/node` to `^5.4.0`. `CheckoutPayload` gains `requestedAmount` and `gasFeeAmount`: a charge's `amount` now includes a gas fee the payer covers, so `merchantAmount + feeAmount + gasFeeAmount` adds up to `amount`. `SettlementStatus` gains `below_minimum`, which breaks an exhaustive `switch` over it.
