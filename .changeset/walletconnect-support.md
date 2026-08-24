---
"@klappay/checkout-kit": minor
---

Adds `@klappay/checkout-kit/client/walletconnect` — a second, optional
way to obtain the `Eip1193Provider` that `createWalletPayment()`/
`createSwapPayment()` already accept as their third argument, for a
payer who only has a wallet *app* to pair with (a mobile browser tab
with no in-app wallet browser, or a desktop browser with no wallet
extension installed) rather than an injected `window.ethereum`.

`createWalletConnectProvider({ projectId, chainIds, metadata })`
returns `{ connect, disconnect, on }`. `on('uri', ...)` gets you the
raw WalletConnect pairing string to render as a QR code or deep link
however you choose — no modal ships with this package, same "bring
your own UI" stance as `buildPaymentUri()`. `connect()` resolves to a
provider once the payer approves on their wallet app; pass it straight
into `createWalletPayment()`/`createSwapPayment()` — nothing else about
paying changes.

`@walletconnect/universal-provider` is a `peerDependency`
(`peerDependenciesMeta.optional: true`), not a regular dependency —
several MB of the WalletConnect relay/pairing/sign protocol, so it's
only installed by whoever actually imports this subpath. It stays
external in the build (`dist/client/walletconnect.js` is ~2KB); the
main `/client` bundle (`~8.8KB` IIFE, `~15.5KB` ESM) is completely
unaffected. This subpath has no IIFE build, unlike `/client` — wiring
up a WalletConnect `projectId` and rendering a QR code assumes a build
step already exists.

Also fixes `Eip155Provider`'s (the underlying library's EVM sub-
provider) `eth_chainId` returning a raw JS `number` instead of the
`0x`-prefixed hex string every EIP-1193 provider (and this package's
own `switchChain()`) expects — normalized by a small adapter, verified
against the real WalletConnect relay with a live `projectId`, not just
mocked tests.
