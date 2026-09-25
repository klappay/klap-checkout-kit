---
"@klappay/checkout-kit": minor
---

Bump `@klappay/node` to `^5.1.1` and `@klappay/types` to `^5.1.1`, which onboard `arc` and `tron` as `Network` values. (`5.1.0` briefly shipped a bundle-size regression in `@klappay/types`'s `/constants` subpath — fixed in `5.1.1`, see below.)

`arc` is EVM-compatible (Circle's own L1, USDC as native gas), so `resolvePaymentOptions()` resolves a `chainId`/`contractAddress` for it exactly like any other EVM network — no code change needed there beyond the type bump. `getAddEthereumChainParams()` (`switchChain()`'s `wallet_addEthereumChain` fallback) now also has an Arc entry (`nativeCurrency: USDC`, public RPC at `rpc.mainnet.arc.io`/`rpc.testnet.arc.network`), and `confirmingExplorerUrl()`'s timeout table has an Arc entry.

`tron` is not EVM — `CHAIN_IDS`/`getAddEthereumChainParams()` have no mapping for it, since TRON has no `chainId`/EIP-1193 wallet flow at all. Adds `isEvmNetwork()` (exported from both subpaths) so `resolvePaymentOptions()` and `createSwapPayment()` can tell the two apart instead of indexing an EVM-only lookup table with a `Network` that might be `'tron'`. A `tron` accepted-payment pair now correctly resolves `chainId: null` (still payable by QR/address, just not by wallet) instead of a type error; `createSwapPayment()` throws its existing "no chain mapping" error for a `tron`-input quote (swap-to-pay has no TRON alt-tokens to trigger this in practice today, but the guard is now type-correct instead of assumed).

`confirming.ts`'s TRON timeout (2 minutes) and Arc's (1 minute) are UI-only defaults, not on-chain enforcement — chosen from each network's own confirmation depth (`tron`: 20 blocks × ~3s; `arc`: 1 block, sub-second finality), not copied from an unrelated network's bucket.
