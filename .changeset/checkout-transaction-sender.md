---
"@klappay/checkout-kit": minor
---

`checkCheckout()`'s result now carries `transactionSender` — the checked transaction's own signer, which stays the payer's real wallet even when the payment routed through a swap/aggregator, unlike the credited transfer's own sender. Adds the `CheckedCheckoutPayload` type. Bumps `@klappay/node` to `^3.5.0` and `@klappay/types` to `^3.6.0`.
