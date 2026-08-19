# @klappay/checkout-kit

## 1.1.0

### Minor Changes

- 6e91c7d: `createCheckoutKit()`'s `apiKey`/`baseUrl` are now optional, and the
  whole `options` argument defaults to `{}` — `createCheckoutKit()` with
  no arguments is now valid. This forwards straight into `@klappay/node`
  (bumped to `^3.1.0`), which as of that version falls back to
  `process.env.KLAP_API_KEY`/`process.env.KLAP_BASE_URL` for whichever
  field is omitted, an explicit argument always winning over its env var.
  `CreateCheckoutKitOptions` now reuses `@klappay/node`'s own
  `CreateClientOptions` type instead of a hand-duplicated `{ apiKey:
string; baseUrl: string }` shape.

  Backward compatible — every existing `createCheckoutKit({ apiKey,
baseUrl })` call site behaves identically.
