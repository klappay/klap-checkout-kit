---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/types` to `^5.2.0` and `@klappay/node` to `^5.1.2`, which re-enable USDC/USDT payments on BNB Chain (`live`). No API change: `resolvePaymentOptions()` already resolves BNB's 18-decimal deployments, so `bnb` pairs on a charge now come back as wallet-payable options with the right `amountUnits`.
