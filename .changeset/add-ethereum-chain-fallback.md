---
"@klappay/checkout-kit": minor
---

`createWalletPayment()`'s `pay()` and `createSwapPayment()`'s `pay()`
now fall back to `wallet_addEthereumChain` when the wallet rejects
`wallet_switchEthereumChain` with "unrecognized chain" (`error.code
=== 4902`), then retry the switch once — instead of letting that error
surface immediately. This matters most for polygon/arbitrum/avalanche/
bnb, networks a default wallet is less likely to have preloaded than
base/optimism/ethereum. Any other rejection (a different error code, a
chain this package has no metadata for, or the retried switch itself
failing) still surfaces exactly as before — nothing is silently
swallowed.

New internal module `client/chain-metadata.ts` provides the
`chainName`/`nativeCurrency`/`rpcUrls`/`blockExplorerUrls` payload,
built from `@klappay/types/constants` plus this package's own small
native-currency and public-RPC-URL tables (not something
`@klappay/types` has an equivalent for). Not part of the public API.

No breaking changes — `pay()`'s signature, events, and status machine
are unchanged; this only changes what happens after a 4902 rejection
that previously just failed the payment outright.
