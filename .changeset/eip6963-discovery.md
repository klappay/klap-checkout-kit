---
"@klappay/checkout-kit": minor
---

Adds `discoverProviders()` (`@klappay/checkout-kit/client`) — dispatches
the standard EIP-6963 `eip6963:requestProvider` event and collects
every wallet extension that responds, each as
`{ info: { uuid, name, icon, rdns }, provider }`. Lets an integrator
build a real "choose your wallet" picker instead of
`createWalletPayment()`'s default `getInjectedProvider()` guessing at
whichever extension last claimed `window.ethereum` when more than one
is installed. The chosen `.provider` plugs into the existing third
argument of `createWalletPayment()`/`createSwapPayment()` — nothing
about paying with one changes.

`discoverProviders()` is a one-shot call (listen, dispatch, wait one
tick, resolve), not a persistent listener — safe for this package's
`"sideEffects": false` and for SSR frameworks that may import client
code with no `window` at all. `window.ethereum.providers` (documented
previously as the only workaround for multiple injected wallets)
remains a fallback for wallets that predate EIP-6963.
