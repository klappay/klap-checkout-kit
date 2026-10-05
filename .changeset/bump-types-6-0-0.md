---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/types` to `^6.0.0` and `@klappay/node` to `^5.1.3`. Arc now settles through the official 0xSplits v2.2 factory, so a charge can accept `arc` alongside any other EVM network (only `tron` stays isolated). No API change: this package never referenced `NetworkFamily`/`NETWORK_FAMILIES`, and `resolvePaymentOptions()` already returns a wallet-payable option for every accepted `arc` pair, mixed or not.
