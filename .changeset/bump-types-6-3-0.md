---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/types` to `^6.3.0`. No checkout-kit API changes: 6.3.0 only adds the `RecipientTransferability` schemas for the merchant-side `GET /v1/recipients/{id}/transferability` endpoint. `Charge` and every constant this package imports are unchanged, and `@klappay/types/constants` stays zod-free.
