---
"@klappay/checkout-kit": minor
---

Bumps `@klappay/node` to `^5.2.0` and `@klappay/types` to `^6.1.0`. `checkCheckout()`'s `CheckedCheckoutPayload` now also carries `tokenSenders` (the `from` of each paying accepted-token transfer) and `userOperationSenders` (the ERC-4337 account whose own user operation paid), alongside `transactionSender` — evidence of who paid when the payer didn't sign the transaction itself (an EIP-7702 wallet behind a gas-sponsoring relayer, or a bundler-submitted user operation). Both are `[]` whenever `transactionSender` is `null`.
