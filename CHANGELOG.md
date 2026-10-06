# @klappay/checkout-kit

## 1.9.3

### Patch Changes

- 0dae815: Bumps `@klappay/node` to `^5.1.4`, which treats an empty successful response body (e.g. `202 Accepted`) as `undefined` instead of throwing `Unexpected end of JSON input`. No API change here. The examples also move from `@klappay/node` `^3.3.0` to `^5.1.4`.

## 1.9.2

### Patch Changes

- 2002af8: Bumps `@klappay/types` to `^6.0.0` and `@klappay/node` to `^5.1.3`. Arc now settles through the official 0xSplits v2.2 factory, so a charge can accept `arc` alongside any other EVM network (only `tron` stays isolated). No API change: this package never referenced `NetworkFamily`/`NETWORK_FAMILIES`, and `resolvePaymentOptions()` already returns a wallet-payable option for every accepted `arc` pair, mixed or not.
- db41b08: Fixes the `wallet_addEthereumChain` fallback for Arc: `nativeCurrency.decimals` is now `18` (Arc's native gas USDC precision) instead of `6`, which MetaMask rejected, so a wallet without Arc preloaded can add it now. Arc testnet's public RPC also moves to `https://rpc.testnet.arc.io`, the domain Arc's current docs list. Payment amounts are unaffected: `amountUnits` still uses the 6-decimal ERC-20 USDC interface.

## 1.9.1

### Patch Changes

- c321fc2: Bumps `@klappay/types` to `^5.2.0` and `@klappay/node` to `^5.1.2`, which re-enable USDC/USDT payments on BNB Chain (`live`). No API change: `resolvePaymentOptions()` already resolves BNB's 18-decimal deployments, so `bnb` pairs on a charge now come back as wallet-payable options with the right `amountUnits`.
- ae6efcd: Updates the README/docs logo, favicon, and docs dark-theme accent to Klappay's new brand. The duplicate root `logo.png` is no longer shipped in the package; the README now points at `docs/public/logo.png`.

## 1.9.0

### Minor Changes

- 34881d7: Bump `@klappay/node` to `^5.1.1` and `@klappay/types` to `^5.1.1`, which onboard `arc` and `tron` as `Network` values. (`5.1.0` briefly shipped a bundle-size regression in `@klappay/types`'s `/constants` subpath — fixed in `5.1.1`, see below.)

  `arc` is EVM-compatible (Circle's own L1, USDC as native gas), so `resolvePaymentOptions()` resolves a `chainId`/`contractAddress` for it exactly like any other EVM network — no code change needed there beyond the type bump. `getAddEthereumChainParams()` (`switchChain()`'s `wallet_addEthereumChain` fallback) now also has an Arc entry (`nativeCurrency: USDC`, public RPC at `rpc.mainnet.arc.io`/`rpc.testnet.arc.network`), and `confirmingExplorerUrl()`'s timeout table has an Arc entry.

  `tron` is not EVM — `CHAIN_IDS`/`getAddEthereumChainParams()` have no mapping for it, since TRON has no `chainId`/EIP-1193 wallet flow at all. Adds `isEvmNetwork()` (exported from both subpaths) so `resolvePaymentOptions()` and `createSwapPayment()` can tell the two apart instead of indexing an EVM-only lookup table with a `Network` that might be `'tron'`. A `tron` accepted-payment pair now correctly resolves `chainId: null` (still payable by QR/address, just not by wallet) instead of a type error; `createSwapPayment()` throws its existing "no chain mapping" error for a `tron`-input quote (swap-to-pay has no TRON alt-tokens to trigger this in practice today, but the guard is now type-correct instead of assumed).

  `confirming.ts`'s TRON timeout (2 minutes) and Arc's (1 minute) are UI-only defaults, not on-chain enforcement — chosen from each network's own confirmation depth (`tron`: 20 blocks × ~3s; `arc`: 1 block, sub-second finality), not copied from an unrelated network's bucket.

## 1.8.0

### Minor Changes

- 41c25a4: Bump `@klappay/node` to `^5.0.0` and `@klappay/types` to `^5.0.0`.

  `CheckoutPayload` now carries `amountExact`/`amountReceivedExact` (decimal-string counterparts to `amount`/`amountReceived`, safe from the precision loss a JSON number can suffer) and `paymentUnavailable` (pauses payment instructions/fulfillment for a charge without changing its `status`) — both `null`/`false` for a charge fetched from an older Core deployment that predates them. `SwapQuote` gains matching `inputAmountExact`/`outputAmountExact`/`fees.klappayFeeExact`/`fees.zeroExFeeExact`, flowing straight through `getSwapQuote()`.

  Fixes a latent bug in `resolvePaymentOptions()`: `amountUnits` used to be computed once per charge with a flat 6-decimal default, applied to every accepted `(token, network)` pair regardless of that pair's actual on-chain decimals. Not every deployment uses 6 — BNB Chain's cataloged USDC/USDT are 18 — so a charge accepting a non-6-decimal pair would tell a wallet to send the right-looking number at the wrong scale. `resolvePaymentOptions()` now looks up each pair's own deployment via `@klappay/types@4.1.0`'s `getTokenDeployment()` and computes `amountUnits` per pair, falling back to `TOKEN_DECIMALS` only when a pair has no deployment metadata. Adds `remainingAmount()` (the plain-number remaining balance, no unit conversion) as an exported building block alongside the existing `remainingAmountUnits()`/`toTokenUnits()`.

  Swap-to-pay's trusted alt-token set also grew upstream (`'MATIC'` renamed to `'POL'`, plus `LINK`/`ARB`/`OP`/`CBETH` as new ERC-20 inputs) — this package never hardcodes the `AltToken` list, so it's available with no code change here, just the type bump.

## 1.7.0

### Minor Changes

- 7edfc61: Bump `@klappay/node` to `^4.2.0` and `@klappay/types` to `^4.0.0`.

  `CheckoutPayload` now carries `feePayer`/`feePercent`/`feeAmount`/`merchantAmount`, so an integrator can render a price breakdown without reimplementing the fee math. `checkCheckout()`'s `CheckedCheckoutPayload` now also carries `confirmationProgress` (`{ network, blocksSeen, blocksRequired, percent }`), non-null while a detected transfer hasn't yet reached its network's confirmation depth.

  Adds `watchCheckoutWithProgress(chargeId, signal?)`, an `AsyncGenerator<CheckoutEvent>` alternative to `watchCheckout()` that also observes `confirmation_progress` SSE events on the same connection (built on `@klappay/node@4.2.0`'s new `charges.watchEvents()`). `watchCheckout()` itself is unchanged.

## 1.6.1

### Patch Changes

- c7684dc: Bump `@klappay/node` to `^4.0.0` and `@klappay/types` to `^3.7.0`. Upstream adds `charges.refund()` for escrow-configured charges and removes `sandbox.releaseEscrow()`/`waitFor('charge.escrow_released')` — neither used by this package, so no code change.

## 1.6.0

### Minor Changes

- 55a2d4a: `checkCheckout()`'s result now carries `transactionSender` — the checked transaction's own signer, which stays the payer's real wallet even when the payment routed through a swap/aggregator, unlike the credited transfer's own sender. Adds the `CheckedCheckoutPayload` type. Bumps `@klappay/node` to `^3.5.0` and `@klappay/types` to `^3.6.0`.

## 1.5.2

### Patch Changes

- b281d29: Bump `@klappay/node` to `^3.4.2` and `@klappay/types` to `^3.5.2`. Both are doc-only patches (document the `409 idempotency_key_reused` error on `charges.create()`'s `idempotencyKey`) — no schema or code change.

## 1.5.1

### Patch Changes

- 6a8ce08: Bumps `@klappay/node` to `^3.4.1` and `@klappay/types` to `^3.5.1`,
  which add escrow release support (`klap.charges.release(id, { signature
})`, `Charge.escrow`, and the `charge.escrow_released` webhook event),
  plus lift the server-side guard that previously rejected `create()`
  with an `escrow` config (`503 escrow_unavailable`) — escrow charges are
  now creatable end to end, not just releasable. Both are merchant-side
  concerns (create with `escrow` is a `POST /v1/charges` input choice,
  release is a merchant-initiated, backend-only action) — never
  something a payer's checkout flow triggers or needs to know about.
  `Charge.address` is unchanged for an escrow charge — a payer still
  sends funds there exactly as before.

  No new wrapper added here on purpose: unlike `checkCheckout()`/
  `getSwapQuote()`, releasing an escrow requires the merchant to construct
  and sign a Safe transaction themselves (entirely outside what this
  package does), so a thin `checkout.releaseEscrow()` proxying just the
  last `{ signature }` call wouldn't save any real integration work.
  `checkout.client.charges.release(...)` is already reachable directly,
  same as webhook management and metrics.

  Test fixtures (`src/node/payload.test.ts`, `src/node/wallet-payment.test.ts`)
  updated with the new required `escrow: null` field — no other code
  changes needed, `toCheckoutPayload()`/`resolvePaymentOptions()` are
  unaffected.

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
