---
"@klappay/checkout-kit": minor
---

Adds `isUserRejection(error)` to `/client`. It returns `true` when the payer declined the wallet prompt: EIP-1193 code `4001`, WalletConnect `5000`, or a "user rejected/denied" message, including when the error is wrapped in `error.cause`. Generic JSON-RPC failures such as `-32000` aren't treated as rejections. `pay()` still emits and rethrows the raw provider error unchanged.
