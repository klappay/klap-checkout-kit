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

```ts
import { getInjectedProvider } from '@klappay/checkout-kit/client'

if (!getInjectedProvider()) {
  // no window.ethereum at all — show "install a wallet" instead of a connect button
} else {
  const wallet = createWalletPayment(option, payload.address) // uses getInjectedProvider() internally
}
```

With multiple wallets installed at once (e.g. MetaMask + Coinbase
Wallet), `window.ethereum` is whichever one last claimed the slot —
`discoverProviders()` is the standardized (EIP-6963) way to let the
payer pick instead of guessing:

```ts
import { discoverProviders } from '@klappay/checkout-kit/client'

const providers = await discoverProviders() // [{ info: { uuid, name, icon, rdns }, provider }, ...]
// render one button per providers[].info.name/.icon, then:
const chosen = providers.find((p) => p.info.name === 'MetaMask')
const wallet = createWalletPayment(option, payload.address, chosen?.provider)
```

`discoverProviders()` dispatches the standard `eip6963:requestProvider`
event and collects every wallet extension that responds — real name,
real icon, no guessing at `window.ethereum`. It's a one-shot call (not
a persistent listener), so call it again if a wallet extension loads
after the page does. For a wallet that predates EIP-6963,
`window.ethereum.providers` (an array, when present) is still a
fallback:

```ts
const providers = window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : [])
const metaMask = providers.find((p) => p.isMetaMask)
const wallet = createWalletPayment(option, payload.address, metaMask)
```

`pay()` does the full flow in one call: checks the wallet's current
chain against `option.chainId` and requests `wallet_switchEthereumChain`
if they differ, then sends a hand-encoded
`transfer(address,uint256)` call — no ethers.js/viem, no ABI file. If
the wallet rejects the switch because it doesn't already have that
network configured (`wallet_switchEthereumChain` error `4902`),
`switchChain()` (used internally by both `pay()` here and
`createSwapPayment()`'s) falls back to `wallet_addEthereumChain` with
this package's own chain metadata (name, native currency, a public RPC
URL, block explorer) and retries the switch once — only for a network
this package actually resolves a chain ID for; any other rejection
(including a still-failing add) surfaces as-is. On success it emits
`'sent'` with the transaction hash and resolves with it; on failure it
emits `'error'` and rethrows, so `error.code === 4001` (user rejected)
is still inspectable by your own catch block.

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

### Building your own `eth_sendTransaction` call

`encodeErc20Transfer(to, amountUnits)` is the raw calldata encoder
`pay()` uses internally — also exported, for anyone who wants the
`chainId`/switch-check/send steps under their own control instead of
going through `createWalletPayment()`:

```ts
import { encodeErc20Transfer, getInjectedProvider } from '@klappay/checkout-kit/client'

const provider = getInjectedProvider()!
const data = encodeErc20Transfer(payload.address, option.amountUnits) // '0xa9059cbb...'

const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{ from: account, to: option.contractAddress, data }],
})
```

No chain-switch check, no status tracking, no `'sent'`/`'error'`
events — `createWalletPayment()` already does all three; reach for this
only when you need a transaction shaped differently than `pay()`
produces.

### Reconnecting on reload

```ts
const account = await wallet.reconnect() // null if not already authorized — no popup either way
```

`reconnect()` is the non-prompting equivalent of `connect()` — it
checks `eth_accounts` instead of requesting `eth_requestAccounts`, so a
page reload doesn't force the payer through a re-approval popup for a
wallet that's already authorized this origin.

## Swap-to-pay: paying with a different crypto

For a payer holding ETH/BNB/MATIC/AVAX/BTC instead of a stablecoin the
charge accepts — see [Swap-to-pay](/node#swap-to-pay-paying-with-a-different-crypto)
for `payload.swapAlternatives` and getting a `SwapQuote` from your own
backend first. `createSwapPayment(quote, provider?)` executes it:

```ts
import { createSwapPayment } from '@klappay/checkout-kit/client'

const account = await wallet.reconnect() // or wallet.connect(), same account used as takerAddress above
const quote = await fetch(`/api/checkout/${payload.id}/quote`, {
  method: 'POST',
  body: JSON.stringify({ inputToken: 'ETH', inputNetwork: 'base', takerAddress: account }),
}).then((r) => r.json())

const swap = createSwapPayment(quote)
swap.on('status', (status) => console.log('status', status)) // 'idle' | 'connecting' | 'checking-allowance' | 'approving' | 'signing' | 'paying' | 'sent' | 'error'
swap.on('approved', (txHash) => console.log('permit2 approved', txHash))
swap.on('sent', (txHash) => console.log('sent', txHash))
swap.on('error', (error) => console.log('failed', error))

await swap.connect() // must be the same account used as takerAddress when the quote was requested
await swap.pay()
```

`pay()` branches on whether `quote.permit2` is present:

- **Native input (ETH/BNB/MATIC/AVAX)** — no `permit2` field. `pay()`
  switches chain if needed, then sends `quote.transaction` as-is.
  Status goes straight from `'connecting'`/`'idle'` to `'paying'`.
- **ERC-20 input (today, only `BTC`)** — `permit2` is present. Before
  signing anything, `pay()` checks whether your wallet has already
  approved the canonical Permit2 contract to move this token
  (`'checking-allowance'`) — a real on-chain `approve()` transaction is
  unavoidable the first time a given wallet uses a given token with
  Permit2, signature-only transfers don't skip it. If it's short,
  `pay()` sends that approval and waits for it to confirm
  (`'approving'`, emits `'approved'` with the tx hash) before
  continuing. Then it signs `quote.permit2.eip712`
  (`'signing'`, a wallet popup, not a transaction) and submits the swap
  (`'paying'`).

Same `error.code === 4001` (user-rejected) applies to both the approval
and the signature/transaction prompts — `pay()` re-throws/emits the raw
provider error either way, no special-casing.

`quote.expiresAt` is a ~30s UI countdown hint, not enforced by this
package — submitting late either reverts on-chain or gets re-quoted at
the current price on submission, it never silently executes at a stale
price. If your UI shows a countdown, re-fetch a fresh quote (same POST
as above) once it lapses instead of retrying `pay()` with the stale
one.

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

`KlapCheckoutKit.createWalletPayment`, `.createSwapPayment`,
`.buildPaymentUri`, `.isWalletPayable`, `.resolveRedirectUrl`,
`.watchCheckoutEvents`, and every other function on this page — same
behavior as the ESM import,
just reachable without a build step. Serve
`node_modules/@klappay/checkout-kit/dist/client/index.global.js`
directly (a second static-file route pointed at that path) instead of
copying it into your own repo, so it always matches whatever version is
actually installed. `/node` has no equivalent IIFE build — it always
runs somewhere `import`/`require` already resolves (Node, a serverless
function, a bundler), so there's nothing for it to solve there.

## WalletConnect: for a payer with a wallet app, not an extension

`createWalletPayment()`/`createSwapPayment()`'s third argument is
"anything shaped like an injected provider" — it doesn't have to be
`window.ethereum`. `@klappay/checkout-kit/client/walletconnect` is a
second, independent way to obtain one, for a payer who only has a
wallet *app* to pair with (mobile Safari/Chrome with no in-app wallet
browser, or any desktop browser with no wallet extension installed):

```bash
pnpm add @walletconnect/universal-provider
```

```ts
import { createWalletConnectProvider } from '@klappay/checkout-kit/client/walletconnect'
import { createWalletPayment } from '@klappay/checkout-kit/client'

const wc = await createWalletConnectProvider({
  projectId: 'YOUR_REOWN_CLOUD_PROJECT_ID',
  chainIds: [option.chainId],
  metadata: {
    name: 'Your Store',
    description: 'Checkout for Your Store',
    url: 'https://your-store.com',
    icons: ['https://your-store.com/icon.png'],
  },
})

wc.on('uri', (uri) => renderYourOwnQrCodeOrDeepLink(uri))

const provider = await wc.connect() // resolves once the payer approves on their phone
const wallet = createWalletPayment(option, payload.address, provider)
await wallet.connect()
await wallet.pay()
```

Everything past `wc.connect()` is identical to the injected-wallet
flow above — same `wallet.on('sent'|'status'|'error', ...)`, same
`switchChain()` behavior, same `createSwapPayment()` if you're doing
swap-to-pay instead. WalletConnect is purely a different way to *get*
a provider; nothing about paying with one changes.

`projectId` is a free registration at
[cloud.reown.com](https://cloud.reown.com) under your own domain — it
can't be baked into this package as a default, since WalletConnect's
relay infrastructure meters/rate-limits usage per project and ties the
"verified" badge shown in the payer's wallet to your domain, not
this package's. `chainIds` is every chain the payer might pay on in
this session — WalletConnect requires the full set to be pre-approved
at connect time (unlike an injected wallet, it can't add a chain mid-
session; see `wallet_addEthereumChain` above, which doesn't apply
here). No modal or QR-rendering code ships with this subpath —
`wc.on('uri', ...)` hands you the raw pairing string, same "bring your
own" stance as `buildPaymentUri()`.

`@walletconnect/universal-provider` is a `peerDependency`
(`peerDependenciesMeta.optional: true`), not a regular dependency — a
real, several-MB piece of the WalletConnect relay/pairing protocol, so
only installed by whoever actually imports this subpath. This subpath
has no IIFE build either, unlike `/client` — wiring up a
`projectId`/rendering a QR code assumes a build step already exists.

## What this doesn't do

- No WalletConnect modal/QR-renderer — `client/walletconnect`'s
  `'uri'` event hands you the raw pairing string, same "bring your
  own" stance as `buildPaymentUri()`.
- No classification of wallet errors — `error.code === 4001` on the
  `'error'` event means the payer rejected the transaction; anything
  else is provider-specific. No UI copy belongs in this package.
- No automatic re-quote when a `SwapQuote` expires — `createSwapPayment()`
  takes a fixed quote and doesn't watch `expiresAt`; fetching a fresh
  one after it lapses is on your own UI.
