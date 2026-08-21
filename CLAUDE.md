# klap-checkout-kit

Engineering conventions for whoever (human or agent) is editing this
code — not user-facing documentation. This is a toolkit for building a
**custom** Klappay checkout — for a merchant (or product, e.g. klap-link)
who wants their own UI instead of redirecting to klap-checkout's hosted
`/c/:id` page. It is not itself a checkout UI, and it never will be —
see "Why this exists" below.

## Why this exists

klap-checkout is Core's own hosted checkout — same visual identity for
every merchant, by design (a payer should recognize it, the way "Powered
by Stripe" is a trust signal, not just branding). Whoever wants a
genuinely custom checkout should build their own — that's not this
repo's job. What *is* this repo's job: the two non-trivial pieces every
custom checkout needs, already built once and audited inside
klap-checkout, extracted into a reusable, agnostic form:

1. **Node-side**: turning a `Charge` (already fully available to a
   merchant via `@klappay/node` with their own API key — `GET
   /v1/charges/{id}`, `/timeline`, `/events`, `/qrcode` are all
   key-authenticated, nothing new needed from Core) into whatever a
   payment UI actually needs to render: which `(token, network)` pairs
   are still payable, and for each, the exact `chainId`/`contractAddress`/
   `amountUnits` a wallet needs to send the right transaction. This math
   (`src/node/wallet-payment.ts`) is a straight port of klap-checkout's
   own `src/lib/wallet-payment.ts`, generalized from `InternalCharge` to
   the full public `Charge` — no redaction needed here, since the caller
   already owns the charge (it's their own API key).
2. **Client-side**: talking to an injected EIP-1193 wallet (`connect` →
   maybe `wallet_switchEthereumChain` → `eth_sendTransaction` with a
   hand-encoded `transfer(address,uint256)`) — a straight port of
   klap-checkout's `public/wallet.js`, generalized into a headless
   controller with no DOM/id assumptions.

Both halves already existed, working, inside klap-checkout — this repo
doesn't invent new logic, it un-couples logic that was previously
trapped behind one specific Hono/JSX UI.

## Two subpaths, one package, not two packages

`@klappay/checkout-kit/node` and `@klappay/checkout-kit/client` are
one versioned package (see `package.json`'s `exports` map), not two
separate npm packages. Reasoning:

- **They're version-coupled.** The client trusts the exact shape the
  node half produces (`CheckoutPayload`/`PaymentOption` — see
  `src/types.ts`). Splitting into two packages only invites the two
  drifting out of sync across independent version bumps; one package,
  one version, makes that impossible.
- **The real boundary isn't "package," it's DOM + secret, not file
  location.** The node half holds an API key and must never reach a
  browser bundle; the client half must never import DOM-touching or
  secret-holding node code. `src/types.ts`/`src/payment-uri.ts` (the
  shared root) cross both, and so does one thing that isn't in the
  shared root: `src/client/redirect-url.ts`'s `resolveRedirectUrl()`,
  imported directly by `src/node/index.ts`. It stays where it is rather
  than moving to the shared root because it's client-first in intent
  (validating a URL right before `window.location.href = ...`) — but
  it's also a single pure scheme check, no DOM, no secret, so nothing
  stops a merchant validating/echoing `Charge.redirectUrl` server-side
  from reaching it without a separate `/client` import just for that
  one function. This is enforced by `assertServerOnly()`
  (`src/node/guard.ts`), a
  one-line runtime check thrown at the top of every node entry module
  — `if (typeof window !== 'undefined') throw`. Two npm packages
  wouldn't have stopped anyone from importing the wrong one into a
  browser bundle either; this does, immediately, loudly, at import time.
  The subpath is named `/node` (not `/server`) to name the runtime it
  requires, not a role — this same code runs equally in a serverless
  function, a long-running server, or a CLI script, anywhere Node/an
  API-key secret can live.

## Client build: ESM and IIFE, not just ESM

`/client` builds to two formats (`tsup.config.ts`): `dist/client/index.js`
(ESM, for anyone with a bundler) and `dist/client/index.global.js` (IIFE,
`window.KlapCheckoutKit`, minified). `/node` stays ESM-only — it always
runs somewhere with `import`/`require` already available (Node, a
serverless function, a bundler), no reason to ship an IIFE there. The
IIFE exists for the opposite case on the client side: a merchant frontend
with **no bundler at all** (plain `<script>` tags, no `import` resolution
possible in a browser for a bare specifier like
`@klappay/checkout-kit/client`) — klap-checkout itself is exactly this
case (`hono/jsx` SSR, `public/*.js` served as-is, documented on purpose
in its own CLAUDE.md). Point a second `serveStatic` (or equivalent) at
`node_modules/@klappay/checkout-kit/dist/client/index.global.js` and add
a `<script>` tag for it; `window.KlapCheckoutKit.createWalletPayment(...)`
etc. become callable with zero build step on the consuming side.

tsup's config array runs every entry **concurrently**
(`Promise.all` over the array, confirmed by reading tsup's own source —
not documented behavior to assume), not in sequence. `clean` therefore
has to be `false` in every one of the three config objects here (two for
`/client`'s two formats, one for `/node`) — a `clean: true` racing
against another config's in-flight write to the same `dist/` folder is
a real, timing-dependent way to intermittently ship a build missing
files. `dist/` is cleaned once, deterministically, before tsup ever
starts, in the `build` npm script itself (`rm -rf dist && tsup`) instead.

## Node API shape: convenience wrapper + composable pieces

`createCheckoutKit({ apiKey, baseUrl })` (or `{ client }` if you already
built a `@klappay/node` client elsewhere and don't want a second one)
returns `getCheckoutPayload(chargeId)` — the one-call, 80%-case path:
fetch the charge, shape it into `CheckoutPayload`, done.

That convenience wrapper is composed from smaller, independently
exported pieces (`toCheckoutPayload()`, `resolvePaymentOptions()`,
`client.charges.get()` directly) precisely so "customizar o que retorna
pro front" doesn't need a bolted-on `transform`/`select` option — an
integrator who wants a different shape calls the pieces themselves and
builds their own object, same ladder-rung philosophy as everywhere else
in this codebase family: ship the one-liner, leave the building blocks
reachable underneath it.

`toCheckoutPayload()` deliberately returns a **curated subset** of
`Charge`, not the raw object — `apiKeyId`, `externalRef`, `source`,
`metadata` are the merchant's own bookkeeping, not something that needs
to reach a payer's browser by default. `getCharge(chargeId)` is exported
too for anyone who wants the full raw `Charge` instead.

`CreateCheckoutKitOptions` is `CreateClientOptions` (re-exported from
`@klappay/node`, not hand-duplicated) `| { client }` — reuse before
writing applies to the option type too, not just the logic. This is
what makes `@klappay/node@3.1`'s `KLAP_API_KEY`/`KLAP_BASE_URL` env-var
fallback (`createClient()` falling back to `process.env` for whichever
of `apiKey`/`baseUrl` is omitted, an explicit arg always winning) work
here for free — `createCheckoutKit()` just forwards `options` straight
into `createClient()`, so the moment upstream's `CreateClientOptions`
gained optional fields, so did ours, with no separate opt-in needed on
this side. `options` itself now defaults to `{}` so
`createCheckoutKit()` with zero arguments is valid too, matching
upstream's own `createClient()` signature.

## QR codes: no round-trip needed

Core's `/v1/charges/{id}/qrcode` exists and works (proxied by
`@klappay/node`'s `charges.getQrCode()`), but a custom checkout doesn't
need it: once `resolvePaymentOptions()` has computed `chainId` +
`contractAddress` + `amountUnits`, the EIP-681 URI
(`buildPaymentUri()`, `src/payment-uri.ts`) is fully knowable
client-side, from data already in the `CheckoutPayload` — no extra
network call, no extra secret-holding round trip through the merchant's
own backend. `buildPaymentUri()` is exported from both subpaths (it's
pure, no secrets, no DOM) — `/node` if you want to render your own SVG
with `getQrCode()`-equivalent output, `/client` to hand straight to any
QR-rendering library of choice. This repo doesn't ship a QR renderer
itself — that's the one dependency genuinely left to the integrator, on
purpose (real "agnostic," not "agnostic except we still picked your QR
library").

## Live status: must proxy through the merchant's own backend

`/v1/charges/{id}/events` (SSE) is API-key-authenticated — a browser
can never hit it directly without exposing the secret key. `watchCheckout()`
(`src/node/events.ts`) wraps `@klappay/node`'s `charges.watch()` (an
`AsyncGenerator<Charge>`, already built) into an `AsyncGenerator<CheckoutPayload>`
a merchant wires into *their own* SSE/WS route — this repo intentionally
does not ship a framework-specific (Hono/Express/...) adapter for that;
an async generator is the lowest common denominator every framework can
consume in a few lines, and shipping N framework adapters is scope this
package doesn't need yet. `watchCheckoutEvents()` on the client side is
the browser half — a plain `EventSource` wrapper expecting `event:
charge` / `data: <CheckoutPayload JSON>`, matching Core's own SSE
contract shape, pointed at whatever URL the merchant's backend exposes.

## Webhook verification: re-exported, not reimplemented

`verifyWebhookSignature()`/`constructWebhookEvent()` (node subpath)
are a straight re-export of `@klappay/node`'s own functions — this
package already depends on `@klappay/node`, and it already ships a
correct, tested `X-Klappay-Signature` HMAC-SHA256 implementation
(`t=<unix>,v1=<hex>` header, `timingSafeEqual` comparison, tolerance
window). Reuse before writing: a second hand-rolled HMAC check here
would be exactly the kind of security-sensitive duplication this
package exists to avoid elsewhere (see `CHAIN_IDS` below). Re-exporting
just saves an integrator a second import from a package they may not
otherwise touch directly.

## Network/token constants: imported, not hand-duplicated

This used to be a "known duplication, fix it upstream someday" section —
as of `@klappay/types@3.1.0` that fix landed for real, so this documents
the resolved state instead (see git history on this section for the
prior duplication writeup, if that context is ever needed again).

`@klappay/types@3.1.0` added a canonical `CHAIN_IDS` export
(`networks.ts`, alongside the pre-existing `NETWORK_LABELS`/
`NETWORK_EXPLORERS`) and — critically for `/client` — a zero-zod
`@klappay/types/constants` subpath (`package.json` now has
`"sideEffects": false`, and every pure constant lives in its own
`*.constants.ts` file, split out from the file holding its zod schema).
`src/node/wallet-payment.ts` imports `CHAIN_IDS`/`TOKEN_ADDRESSES`/
`TOKEN_DECIMALS` straight from `@klappay/types` (the main export — no
bundle-size concern server-side, so no reason to reach for the
`/constants` subpath there). `src/client/permit2.ts` and
`src/client/confirming.ts` import `CHAIN_IDS`/`ALT_TOKEN_ADDRESSES`/
`ALT_TOKEN_DECIMALS`/`NETWORK_EXPLORERS` from `@klappay/types/constants`
instead — measured with a real `esbuild` bundle of just
`ALT_TOKEN_ADDRESSES`: 585 bytes, versus ~188KB (all ~30 unrelated zod
schemas plus zod itself) importing the exact same constant from the
main `.` export used to cost, back when this was still a duplicated
local copy. The full `/client` IIFE build stayed flat at ~7.3KB across
this whole swap — confirms the fix holds through the real `tsup`
pipeline, not just a synthetic bundle.

`src/client/permit2.ts`'s `CHAIN_IDS` collapses the `Environment`
dimension at each call site (`CHAIN_IDS[network]?.live`), never `?.test`
— a `SwapQuote` is only ever issued for a `live` charge (0x has no
testnet — see `swap-quote.ts` in klap-core), so swap-to-pay never needs
the `test` half of the table. `src/node/wallet-payment.ts` uses both
halves, keyed off `charge.environment`.

## Every accepted pair is returned, not just wallet-payable ones

`resolvePaymentOptions()` returns one `PaymentOption` per
`charge.acceptedPayments` entry, always — `chainId`/`contractAddress`
are `null` when this package has no chain/token mapping for that pair,
rather than silently dropping the pair from the array. A pair with no
wallet mapping is still payable by QR/manual-address (`buildPaymentUri()`
needs a `chainId`, but a payer can also just send to `payload.address`
directly) — dropping it from `paymentOptions` entirely would make a
real, still-payable option invisible to an integrator's UI. Use
`isWalletPayable(option)` (exported from both subpaths) to decide
whether to show a wallet-connect button for a given option;
`createWalletPayment()` throws immediately if handed a non-wallet-payable
option, so that mistake fails loudly instead of producing a broken
`eth_sendTransaction` call.

## Swap-to-pay: a third payment path, ported without a klap-checkout reference

`charge.swapAlternatives` (surfaced on `CheckoutPayload`) and
`createCheckoutKit().getSwapQuote(chargeId, input)` (a thin proxy to
`client.charges.getQuote()`, same shape as `getCharge()`/`getQrCode()`)
let a payer settle a charge with a crypto it doesn't actually accept —
ETH/BNB/MATIC/AVAX/BTC swapped via 0x into whatever stablecoin the
charge does accept, output delivered straight to the charge's own
`address`. There is no persisted `Quote` — `SwapQuote` is a stateless,
on-demand computation against an existing charge (see klap-core's
`src/modules/payments/swap-quote.ts`); `expiresAt` is a ~30s UI
countdown hint only, not what enforces the price (the on-chain
transaction itself does, via a signed Permit2 deadline or a
minimum-output check).

Unlike every other client-side piece in this package,
`src/client/swap.ts`'s `createSwapPayment()` is **not** a port of
existing klap-checkout code — klap-checkout's own hosted UI hadn't
implemented swap-to-pay client-side when this was written (checked:
no `swap`/`permit2`/0x reference anywhere in its `public/*.js`). The
flow was built directly from 0x's own documented Permit2 guide
(`docs.0x.org/evm/0x-swap-api/guides/permit2/...`) instead:

1. If `quote.permit2` is absent (native-currency input — ETH/BNB/MATIC/
   AVAX), `quote.transaction` is submit-ready as-is — send it and done.
2. If `quote.permit2` is present (ERC-20 input — today only `BTC`),
   Permit2 still needs a real on-chain `approve(PERMIT2_ADDRESS,
   maxUint256)` from the payer at least once per (wallet, token) pair
   before any signature-only transfer works — Permit2 pulls funds via a
   plain `transferFrom` under the hood, the signature only authorizes
   *which* transfer, not the allowance itself. `createSwapPayment()`
   checks `allowance(owner, PERMIT2_ADDRESS)` via `eth_call` first and
   only sends the `approve` (and waits for its receipt —
   `APPROVAL_POLL_INTERVAL_MS`/`APPROVAL_POLL_MAX_ATTEMPTS`, a fixed
   2-minute ceiling) when it's actually short. `SwapQuote` doesn't
   surface an allowance hint the way 0x's raw `/quote` response does
   (no `issues.allowance` field on our schema) — this check is done
   independently, client-side, every time.
3. The Permit2 EIP-712 message (`quote.permit2.eip712`) is signed via
   `eth_signTypedData_v4`, then appended to `transaction.data` as a
   32-byte big-endian signature length followed by the raw signature —
   the exact byte-packing 0x's docs specify, unit-tested directly
   (`appendPermit2Signature` in `src/client/permit2.test.ts`) since
   getting this wrong silently produces a transaction that reverts or
   moves the wrong amount.

`src/client/permit2.ts` holds every pure piece `createSwapPayment()`
needs (the network/token tables above, the ERC-20 `allowance`/`approve`
calldata encoders, `appendPermit2Signature`) — no `Eip1193Provider`, no
I/O, fully unit-testable in isolation. `swap.ts` itself is the stateful
orchestration: `pay()`'s chain-switch → allowance-check → approve (if
short) → sign → send sequence, plus the status machine driving it.

`createWalletPayment()` and `createSwapPayment()` share their
event-emitter (`listeners`/`emit`/`on`) and `accountsChanged` wiring —
both extracted into `src/client/emitter.ts`'s `createEmitter<Events>()`
and `wallet.ts`'s own `watchAccountChanges()` once `swap.ts` needed the
exact same ~25 lines a second time (verbatim, not just similar-shaped).
`connect()`/`reconnect()`/`pay()` stay one-off per controller, though —
each wraps its own provider calls in a `setStatus()`/`try`/`catch`
specific to its own status union (`WalletStatus` vs
`SwapPaymentStatus`), and swap's `pay()` has real extra steps
(`ensureAllowance()`) a shared body would have to special-case around,
so forcing those into one generic function would trade a small
duplication for a harder-to-read abstraction — not a net win.

## Status and redirect helpers

`OPEN_STATUSES`/`isOpenStatus()` (exported from both subpaths) mirror
klap-checkout's own `OPEN_STATUSES` (`src/lib/format.ts`) — `pending`
and `partially_paid` are the only two of `ChargeStatus`'s five values
still open for payment; the rest (`confirmed`, `expired`, `underpaid`)
are terminal, per klap-core's charge state machine
(`prisma/schema.prisma`, `src/modules/payments/payment-detection.ts`).
`CheckoutPayload.redirectUrl` passes `Charge.redirectUrl` straight
through — a merchant-configured "send the payer back here after
payment" URL — and `resolveRedirectUrl()` (exported from both
subpaths) mirrors
klap-checkout's `src/lib/redirect-url.ts` scheme check (only
`http:`/`https:` survive) before anything does `window.location.href =
...` with it; the raw field is trusted only once `status === 'confirmed'`,
same as klap-checkout's `ResolvedPanel`.

## Known gaps (accepted, same as klap-checkout)

- **No WalletConnect / mobile-browser-without-injected-provider
  support.** `client/wallet.ts` is EIP-1193-injected-provider-only,
  same limitation klap-checkout's own CLAUDE.md documents as "phase 2,
  not implemented." A payer on a mobile browser tab (not a wallet app's
  in-app browser) has no `window.ethereum` to talk to — document this
  for integrators rather than silently failing.
- **No `wallet_addEthereumChain` fallback** when
  `wallet_switchEthereumChain` fails with "unrecognized chain" (error
  `4902`) — same gap klap-checkout's own `wallet.js` has. Matters more
  here than in klap-checkout, since this package also resolves
  polygon/arbitrum/avalanche/bnb, networks a default wallet is less
  likely to have preloaded than base/optimism/ethereum. Applies equally
  to `createSwapPayment()`'s chain switch.
- **`error.code === 4001` (user-rejected) is not specially classified**
  — `pay()` just re-throws/emits the raw provider error, `error.code`
  is still inspectable by the caller. No UI copy belongs in this
  package; classifying and messaging it is left to the integrator.
- **No re-quote-on-expiry for swap-to-pay.** `createSwapPayment()` takes
  a `SwapQuote` as a fixed input and doesn't watch its `expiresAt` —
  submitting a stale quote either reverts on-chain or 0x/the Settler
  handles it, never silently executes at a bad rate (see "Swap-to-pay"
  above), but the UX of "quote expired, fetch a new one and retry" is
  left entirely to the integrator, same as `error.code === 4001`.

## Test discipline

Same standard as klap-checkout: a test has to exercise real
behavior/branching and would fail if the logic broke. Pure logic
(`wallet-payment.ts`, `payment-uri.ts`, `client/confirming.ts`,
`client/wallet.ts`, `client/permit2.ts`, `client/emitter.ts`) is fully
unit-tested with real fixtures (see
`src/node/wallet-payment.test.ts` for the `Charge` fixture shape,
mirroring klap-checkout's own `src/test/charge-fixture.ts`). DOM-only
tests (`localStorage`) opt into `// @vitest-environment jsdom` per file
— the suite defaults to Node, same as klap-checkout, so a stray
`window` global doesn't silently satisfy `assertServerOnly()` during a
node-module test.

## Code style

Same as klap-checkout: no comments in source (this file, not code, is
where the "why" lives), avoid `as` type assertions except a narrow
already-validated case, Conventional Commits, reuse before writing.

Commit messages: English, Conventional Commits format, no
`Co-Authored-By` trailer — this repo's history is human-authored
commits, agent-assisted or not.

## Releases (Changesets)

Same flow as `../klap-node`, since this is also a public npm package
(`@klappay/checkout-kit`, MIT). Publishing is a two-step, human-gated
process, not a direct `npm publish` on every push. `pnpm changeset`
picks the semver bump — never auto-inferred from the diff.
`.github/workflows/ci.yml`'s `changeset-check` job fails a PR with no
changeset. `.github/workflows/release.yml` (`changesets/action`) opens/
updates a "Version Packages" PR on `main`; merging *that* PR is the
actual publish trigger (`pnpm release` → `changeset publish`, via npm's
OIDC trusted publishing — no `NPM_TOKEN` secret needed).
`npm publish`/`changeset publish`/merging the "Version Packages" PR are
real, external, one-way actions — never run or merge them proactively;
they need the user's explicit go-ahead every time.

## Docs site

`docs/` is a VitePress site, same setup as klap-node's (same dark
theme in `docs/.vitepress/theme/custom.css`, same `vitepress-plugin-llms`
for `llms.txt`/`llms-full.txt`, same `docs.yml` GitHub Pages workflow
gated on `docs/**` changes). No `docs/public/CNAME`/custom domain yet —
unlike klap-node, this package has no subdomain reserved; deploys to
the default `github.io` Pages URL until one exists, at which point add
`docs/public/CNAME` and a `domain` option to `vitepress-plugin-llms` in
`docs/.vitepress/config.mts`, mirroring klap-node's.

`logo.png`/`docs/public/logo.png`/`docs/public/favicon.png` are copied
byte-for-byte from `../klap-node` (identical md5 to klap-core's own
`docs/public/logo.png` too) — the shared org-wide Klappay brand mark,
not a fabricated asset. `docs/public/favicon.png` specifically is
klap-node's (not klap-core's or klap-checkout's slightly different
crops) since klap-node is the closer sibling — another SDK/toolkit
package, not a full hosted product UI.

`pnpm docs:dev`/`docs:build`/`docs:preview` — same three scripts as
klap-node. `docs` is in `package.json`'s `files` array, so it ships in
the npm tarball too, same as klap-node.
