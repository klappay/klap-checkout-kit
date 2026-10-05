---
"@klappay/checkout-kit": patch
---

Fixes the `wallet_addEthereumChain` fallback for Arc: `nativeCurrency.decimals` is now `18` (Arc's native gas USDC precision) instead of `6`, which MetaMask rejected, so a wallet without Arc preloaded can add it now. Arc testnet's public RPC also moves to `https://rpc.testnet.arc.io`, the domain Arc's current docs list. Payment amounts are unaffected: `amountUnits` still uses the 6-decimal ERC-20 USDC interface.
