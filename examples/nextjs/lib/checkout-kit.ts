import { createCheckoutKit } from '@klappay/checkout-kit/node'

// Reads KLAP_API_KEY / KLAP_BASE_URL lazily on first request — this call
// never throws even when both env vars are unset at build/import time (see
// docs/node.md). Credentials are only actually required once a route
// handler calls checkout.getCheckoutPayload()/watchCheckout() at request
// time.
export const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})
