---
"@klappay/checkout-kit": minor
---

Adds `watchCheckoutEventsWithProgress(url, onEvent)` to `/client`, the browser counterpart of `watchCheckoutWithProgress()`. It opens one `EventSource`, listens to both `event: charge` and `event: confirmation_progress` in the route shape documented on the node side, and hands you the same `CheckoutEvent` union. `CheckoutEvent` and `ConfirmationProgress` are now exported from `/client` too. `watchCheckoutEvents()` keeps its exact behavior; both now read `event.data` by shape, so a global `EventSource` polyfill works with either.
