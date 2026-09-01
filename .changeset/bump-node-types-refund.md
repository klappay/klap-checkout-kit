---
"@klappay/checkout-kit": patch
---

Bump `@klappay/node` to `^4.0.0` and `@klappay/types` to `^3.7.0`. Upstream adds `charges.refund()` for escrow-configured charges and removes `sandbox.releaseEscrow()`/`waitFor('charge.escrow_released')` — neither used by this package, so no code change.
