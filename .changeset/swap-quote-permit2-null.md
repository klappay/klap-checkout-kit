---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/types` to `^3.1.1` and `@klappay/node` to `^3.2.2`, which
fix a bug where `SwapQuoteSchema.permit2` was declared `.optional()`
instead of `.nullable()`/`.nullish()`. Core returns `permit2: null`
(not an omitted key) for any swap quote with a native-currency input
(ETH/BNB/MATIC/AVAX) — the common case, since only BTC input actually
carries a `permit2`. The stricter schema rejected that response,
throwing a `ZodError` inside `client.charges.getQuote()` (which
`getSwapQuote()` here just proxies) and surfacing to a merchant's
checkout as an uncaught 500 with a non-JSON body.

No code change needed in this package: `createSwapPayment()`'s
`quote.permit2` checks (`src/client/swap.ts`) are plain falsy checks,
already correct for both `undefined` and `null`.
