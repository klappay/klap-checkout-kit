# @klappay/checkout-kit

## 1.5.0

### Minor Changes

- 7db44be: Adds `discoverProviders()` (`@klappay/checkout-kit/client`) — dispatches
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

## 1.4.0

### Minor Changes

- 0c9c200: `createWalletPayment()`'s `pay()` and `createSwapPayment()`'s `pay()`
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

- 6de2083: Adds `@klappay/checkout-kit/client/walletconnect` — a second, optional
  way to obtain the `Eip1193Provider` that `createWalletPayment()`/
  `createSwapPayment()` already accept as their third argument, for a
  payer who only has a wallet _app_ to pair with (a mobile browser tab
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

## 1.3.0

### Minor Changes

- a6495e5: Bumps `@klappay/node` to `^3.3.0` and `@klappay/types` to `^3.2.0`, and
  adds `checkCheckout(chargeId, input?)` to `createCheckoutKit()`, wrapping
  the new `client.charges.check()` — triggers an immediate on-chain
  re-check of a charge instead of waiting out the ~60s background
  reconciliation pass. Pass `txHash`/`network` (e.g. right after
  `createWalletPayment()`/`createSwapPayment()` sends a transaction) to
  verify that specific transaction directly instead of scanning a block
  range. Rate-limited by Core to once every 10 seconds per charge; never
  trusts the caller — the charge only changes state if a real matching
  transfer is found on-chain. `CheckChargeRequest` is re-exported from
  both `/node` and `/client` alongside the other `@klappay/types`
  convenience re-exports. See "Instant re-check after a payer's
  transaction" in `docs/node.md`.

## 1.2.2

### Patch Changes

- 42304f8: Bumps `@klappay/types` to `^3.1.1` and `@klappay/node` to `^3.2.2`, which
  fix a bug where `SwapQuoteSchema.permit2` was declared `.optional()`
  instead of `.nullable()`/`.nullish()`. Core returns `permit2: null`
  (not an omitted key) for any swap quote with a native-currency input
  (ETH/BNB/MATIC/AVAX) — the common case, since only BTC input actually
  carries a `permit2`. The stricter schema rejected that response,
  throwing a `ZodError` inside `client.charges.getQuote()` (which
  `getSwapQuote()` here just proxies) and surfacing to a merchant's
  checkout as an uncaught 500 with a non-JSON body.

  No code change needed in this package: `createSwapPayment()`'s
  `quote.permit2` checks (`src/client/swap.ts`) are plain falsy checks,
  already correct for both `undefined` and `null`.

## 1.2.1

### Patch Changes

- 580675a: Fixes a bug introduced in `1.2.0`: `src/client/permit2.ts` and
  `src/client/confirming.ts` import real values (`CHAIN_IDS`,
  `ALT_TOKEN_ADDRESSES`, `NETWORK_EXPLORERS`) from
  `@klappay/types/constants`, but `tsup.config.ts`'s client builds never
  marked `@klappay/types` as `noExternal`. Value imports (unlike
  type-only ones) survive into the emitted JS, so the published
  `dist/client/index.js`/`index.global.js` shipped a bare
  `import { ... } from "@klappay/types/constants"` — unresolvable by a
  browser loading the file via `<script type="module">` with no
  bundler, since that specifier only resolves through Node's
  `node_modules` package resolution.

  Adds `noExternal: ['@klappay/types']` to both client build configs
  (`esm` and `iife`) so `@klappay/types`'s constants are inlined into
  the client bundle, same as they already were meant to be. `/node`'s
  build is unaffected — it stays external there since it always runs
  somewhere with real module resolution.

## 1.2.0

### Minor Changes

- 3e26157: Adds swap-to-pay: letting a payer settle a charge with a crypto it doesn't
  actually accept (ETH/BNB/MATIC/AVAX/BTC), swapped via 0x into whatever
  stablecoin the charge does accept.

  - `CheckoutPayload.swapAlternatives: SwapAlternative[]` — which
    `(token, network)` pairs are offerable this way for a given charge
    (always empty for `test`-environment charges, since 0x has no testnet
    support).
  - `createCheckoutKit().getSwapQuote(chargeId, input)` (node) — a thin
    proxy to `@klappay/node`'s `client.charges.getQuote()`, returning a
    stateless `SwapQuote`.
  - `createSwapPayment(quote, provider?)` (client) — executes a
    `SwapQuote` against an injected EIP-1193 wallet: signs and appends a
    Permit2 allowance if the quote needs one (approving it on-chain first
    if the wallet hasn't already), then submits the swap transaction.
    Built directly from 0x's own documented Permit2 guide, not ported
    from an existing reference.

  Bumps `@klappay/node` to `^3.2.0` and `@klappay/types` to `^3.0.2`,
  both required for the new `getQuote()`/`SwapQuote`/`swapAlternatives`
  surface.

  Backward compatible — `CheckoutPayload` only gains a new field, every
  existing export keeps its previous signature.

### Patch Changes

- d0a8c81: Bumps `@klappay/node` to `^3.2.1` and `@klappay/types` to `^3.1.0`, and
  switches every hand-duplicated network/token constant to import from
  the new canonical sources those versions introduced:
  `src/node/wallet-payment.ts` now imports `CHAIN_IDS` from
  `@klappay/types`, and `src/client/permit2.ts`/`src/client/confirming.ts`
  import `CHAIN_IDS`/`ALT_TOKEN_ADDRESSES`/`ALT_TOKEN_DECIMALS`/
  `NETWORK_EXPLORERS` from the new zero-zod `@klappay/types/constants`
  subpath instead of their own local copies.

  No behavior change and no public API change — these constants were
  never exported from this package. `/client`'s IIFE bundle size is
  unaffected (measured before/after: same ~7.3KB).

## 1.1.0

### Minor Changes

- 6e91c7d: `createCheckoutKit()`'s `apiKey`/`baseUrl` are now optional, and the
  whole `options` argument defaults to `{}` — `createCheckoutKit()` with
  no arguments is now valid. This forwards straight into `@klappay/node`
  (bumped to `^3.1.0`), which as of that version falls back to
  `process.env.KLAP_API_KEY`/`process.env.KLAP_BASE_URL` for whichever
  field is omitted, an explicit argument always winning over its env var.
  `CreateCheckoutKitOptions` now reuses `@klappay/node`'s own
  `CreateClientOptions` type instead of a hand-duplicated `{ apiKey:
string; baseUrl: string }` shape.

  Backward compatible — every existing `createCheckoutKit({ apiKey,
baseUrl })` call site behaves identically.
