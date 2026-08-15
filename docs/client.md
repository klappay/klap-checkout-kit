# Client

`@klappay/checkout-kit/client` never touches an API key or calls Core
directly — everything it needs is already in the `CheckoutPayload` your
own backend handed it. No DOM/framework assumptions: every function
here is headless, bring your own UI. Every type this package uses
(`CheckoutPayload`, `PaymentOption`, `ChargeStatus`, etc.) is importable
from this same subpath too — see [Importing types](/node#importing-types).
For React/Vue/Svelte-specific wiring (hooks, composables, stores), see
[Framework examples](/frameworks).

## Connecting a wallet and paying

```ts
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'

const [option] = payload.paymentOptions.filter(isWalletPayable)
const wallet = createWalletPayment(option, payload.address)

wallet.on('account', (account) => console.log('connected', account))
wallet.on('status', (status) => console.log('status', status)) // 'idle' | 'connecting' | 'paying' | 'sent' | 'error'
wallet.on('sent', (txHash) => console.log('sent', txHash))
wallet.on('error', (error) => console.log('failed', error))

await wallet.connect() // prompts the wallet
await wallet.pay() // switches chain if needed, then eth_sendTransaction
```

`createWalletPayment(option, recipientAddress, provider?)` throws
immediately if handed an option with no wallet mapping
(`chainId`/`contractAddress` both `null`) — filter with
`isWalletPayable()` first, or fall back to `buildPaymentUri()`/
`payload.address` for that pair. `provider` defaults to
`getInjectedProvider()` (`window.ethereum`); pass your own if you need
to target a specific provider among several injected ones
(`window.ethereum.providers`).

`pay()` does the full flow in one call: checks the wallet's current
chain against `option.chainId` and requests `wallet_switchEthereumChain`
if they differ, then sends a hand-encoded
`transfer(address,uint256)` call — no ethers.js/viem, no ABI file. On
success it emits `'sent'` with the transaction hash and resolves with
it; on failure it emits `'error'` and rethrows, so `error.code === 4001`
(user rejected) is still inspectable by your own catch block.

### Tracking busy/idle state

`WalletStatus` (`'idle' | 'connecting' | 'paying' | 'sent' | 'error'`) is
tracked internally and emitted on `'status'` — `wallet.getStatus()`
reads it synchronously without subscribing first. This is deliberately
*not* something to re-derive per-integration (wrapping every
`connect()`/`pay()` call in your own `setStatus('connecting')`/
`setStatus('paying')`): a rejected `wallet_switchEthereumChain` prompt
mid-`pay()`, for instance, has to land on `'error'` too, not leave
`status` stuck at `'paying'` forever — that transition is handled once,
here, instead of every integrator needing to get it right independently.
See [Framework examples](/frameworks) for `'status'` wired into
React/Vue/Svelte state.

`Eip1193Provider` and `WalletPaymentEvents` (both exported) are the
types behind `provider`/`wallet.on()` above, for typing your own
provider-selection logic or a wrapper around `wallet.on()`.
`encodeErc20Transfer(to, amountUnits)` is the raw calldata encoder
`pay()` uses internally — also exported, for anyone building their own
`eth_sendTransaction` call instead of going through
`createWalletPayment()`.

### Reconnecting on reload

```ts
const account = await wallet.reconnect() // null if not already authorized — no popup either way
```

`reconnect()` is the non-prompting equivalent of `connect()` — it
checks `eth_accounts` instead of requesting `eth_requestAccounts`, so a
page reload doesn't force the payer through a re-approval popup for a
wallet that's already authorized this origin.

## QR / manual-address fallback

Every payment option is showable, wallet-payable or not — for one with
no wallet mapping, or on a mobile browser tab with no injected
provider, render `payload.address` directly (as a static "send to this
address" QR/text). For a wallet-payable option, `buildPaymentUri()`
builds the EIP-681 URI with no extra network call:

```ts
import { buildPaymentUri } from '@klappay/checkout-kit/client'

const uri = buildPaymentUri(option, payload.address) // throws if !isWalletPayable(option)
```

This package doesn't ship a QR renderer — pipe the URI (or the raw
address) into whatever QR library you already use.

## Tracking "confirming" state across a reload

The payer sent a transaction, but your own status route hasn't caught
up to it yet — persist that locally so a reload doesn't lose it:

```ts
import { saveConfirming, getConfirming, clearConfirming, remainingMs, confirmingExplorerUrl } from '@klappay/checkout-kit/client'

saveConfirming(payload.id, option.network, txHash)

// on reload:
const record = getConfirming(payload.id) // null if none, or timed out
if (record) {
  console.log(remainingMs(record)) // ms left before this network's timeout
  console.log(confirmingExplorerUrl(record)) // block explorer link, or null if no txHash yet
}

clearConfirming(payload.id) // once your status route reflects the real state
```

The timeout is per-network (15 min for `ethereum`, down to 1 min for
`avalanche`) — a record past its timeout is treated as gone;
`getConfirming()` clears and returns `null` for it automatically.
`ConfirmingRecord` (also exported) is the `{ network, startedAt, txHash }`
shape `saveConfirming()`/`getConfirming()` return.

## Watching live status

```ts
import { watchCheckoutEvents } from '@klappay/checkout-kit/client'

const stop = watchCheckoutEvents(`/api/checkout/${payload.id}/events`, (payload) => {
  // re-render with the new payload
})

// later, e.g. on unmount:
stop()
```

A plain `EventSource` wrapper expecting `event: charge` /
`data: <CheckoutPayload JSON>` — matching Core's own SSE contract shape
and pointed at whatever URL your backend's `watchCheckout()` route
exposes (see [Node](/node)). Reconnection on drop is the browser's
native `EventSource` behavior — no custom backoff logic to configure.

## Redirecting after confirmation

```ts
import { resolveRedirectUrl } from '@klappay/checkout-kit/client'

if (payload.status === 'confirmed') {
  const url = resolveRedirectUrl(payload.redirectUrl) // null unless the scheme is http(s)
  if (url) window.location.href = url
}
```

`payload.redirectUrl` is a merchant-configured "send the payer back
here" URL, passed straight through from `Charge.redirectUrl`.
`resolveRedirectUrl()` rejects anything that isn't `http:`/`https:`
before it ever reaches a navigation sink — check `status === 'confirmed'`
first, same as this rejection, before trusting the field at all.

## No bundler? Use the script-tag build

Every example on this page assumes an `import` — fine with a bundler,
but a frontend with none at all (plain `<script>` tags, e.g. a
server-rendered app with no build step) can't resolve
`@klappay/checkout-kit/client` as a specifier. For that case, `/client`
also ships a self-contained IIFE bundle:
`dist/client/index.global.js` — everything already resolved and
inlined, attaches every export from this page to a single global:

```html
<script src="/vendor/klap-checkout-kit/index.global.js"></script>
<script>
  const wallet = KlapCheckoutKit.createWalletPayment(option, payload.address)
  wallet.on('sent', (txHash) => console.log('sent', txHash))
  await wallet.connect()
  await wallet.pay()
</script>
```

`KlapCheckoutKit.createWalletPayment`, `.buildPaymentUri`,
`.isWalletPayable`, `.resolveRedirectUrl`, `.watchCheckoutEvents`, and
every other function on this page — same behavior as the ESM import,
just reachable without a build step. Serve
`node_modules/@klappay/checkout-kit/dist/client/index.global.js`
directly (a second static-file route pointed at that path) instead of
copying it into your own repo, so it always matches whatever version is
actually installed. `/node` has no equivalent IIFE build — it always
runs somewhere `import`/`require` already resolves (Node, a serverless
function, a bundler), so there's nothing for it to solve there.

## What this doesn't do

- No WalletConnect or any wallet that isn't an injected EIP-1193
  provider — no `window.ethereum` (a mobile browser tab, not a wallet
  app's in-app browser) means no wallet flow; QR/manual-address
  payment still works there.
- No `wallet_addEthereumChain` retry if the wallet doesn't already have
  the target network configured (`wallet_switchEthereumChain` error
  `4902`) — `pay()` lets that error surface as-is.
- No classification of wallet errors — `error.code === 4001` on the
  `'error'` event means the payer rejected the transaction; anything
  else is provider-specific. No UI copy belongs in this package.
