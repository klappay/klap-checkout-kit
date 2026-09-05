---
"@klappay/checkout-kit": minor
---

Bump `@klappay/node` to `^4.2.0` and `@klappay/types` to `^4.0.0`.

`CheckoutPayload` now carries `feePayer`/`feePercent`/`feeAmount`/`merchantAmount`, so an integrator can render a price breakdown without reimplementing the fee math. `checkCheckout()`'s `CheckedCheckoutPayload` now also carries `confirmationProgress` (`{ network, blocksSeen, blocksRequired, percent }`), non-null while a detected transfer hasn't yet reached its network's confirmation depth.

Adds `watchCheckoutWithProgress(chargeId, signal?)`, an `AsyncGenerator<CheckoutEvent>` alternative to `watchCheckout()` that also observes `confirmation_progress` SSE events on the same connection (built on `@klappay/node@4.2.0`'s new `charges.watchEvents()`). `watchCheckout()` itself is unchanged.
