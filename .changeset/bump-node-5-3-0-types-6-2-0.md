---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/node` to `^5.3.0` and `@klappay/types` to `^6.2.0`. No checkout-kit API changes: the upstream additions (`charges.prepareRelease()`/`prepareRefund()` and `EscrowSafeTransaction`) are post-payment escrow operations for the merchant's releaser, not part of a payer-facing checkout, and stay reachable through `createCheckoutKit().client`.
