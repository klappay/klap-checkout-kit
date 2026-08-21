---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/node` to `^3.2.1` and `@klappay/types` to `^3.1.0`, and
switches every hand-duplicated network/token constant to import from
the new canonical sources those versions introduced:
`src/node/wallet-payment.ts` now imports `CHAIN_IDS` from
`@klappay/types`, and `src/client/permit2.ts`/`src/client/confirming.ts`
import `CHAIN_IDS`/`ALT_TOKEN_ADDRESSES`/`ALT_TOKEN_DECIMALS`/
`NETWORK_EXPLORERS` from the new zero-zod `@klappay/types/constants`
subpath instead of their own local copies.

No behavior change and no public API change — these constants were
never exported from this package. `/client`'s IIFE bundle size is
unaffected (measured before/after: same ~7.3KB).
