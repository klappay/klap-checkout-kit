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

## Known duplication (not fixed here, flagged for whoever touches this next)

The `CHAIN_IDS` table in `src/node/wallet-payment.ts` re-encodes
network→chainId facts that already exist, hand-duplicated, in two other
places: klap-core's `src/modules/blockchain/moralis.client.ts`
(`CHAIN_ID_TO_NETWORK`, a reverse hex-keyed map with the same values)
and `src/modules/blockchain/evm.ts` (`CHAINS`, sourced from viem's own
`Chain` objects rather than a hand-typed table) — plus klap-checkout's
own `wallet-payment.ts` this was ported from. `@klappay/types` has no
canonical export for it yet (`networks.ts` only has
`NETWORK_LABELS`/`NETWORK_EXPLORERS`/`EVM_NETWORKS`/
`OPERATIONAL_NETWORKS`). Worth promoting into `@klappay/types` as a real
fix; not done here since that touches a different repo.

`src/client/confirming.ts`'s `NETWORK_EXPLORERS` joined this same
tradeoff — it's now hand-copied too, deliberately, instead of imported
from `@klappay/types`. Not a duplication regression: it's the same
package-boundary reasoning as `CHAIN_IDS`, just discovered later, via
the IIFE build (see "Client build: ESM and IIFE" above) — importing one
constant at runtime from a `zod`-based package with no
`sideEffects: false` and no `/* @__PURE__ */` markers on its schema
constructors means a bundler can't prove the other ~30 unrelated
schemas are safe to drop, so it inlines all of them (plus zod itself)
rather than risk it: measured 188KB for what should've been a ~4KB
file. Hand-copying the one object `/client` actually needs sidesteps
the whole tree-shaking gamble — and as a side effect, makes
`@klappay/types` a type-only dependency of `/client` (every remaining
reference is `import type`, erased at compile time, zero runtime
footprint regardless of how aggressive any consumer's own bundler is).

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
  likely to have preloaded than base/optimism/ethereum.
- **`error.code === 4001` (user-rejected) is not specially classified**
  — `pay()` just re-throws/emits the raw provider error, `error.code`
  is still inspectable by the caller. No UI copy belongs in this
  package; classifying and messaging it is left to the integrator.

## Test discipline

Same standard as klap-checkout: a test has to exercise real
behavior/branching and would fail if the logic broke. Pure logic
(`wallet-payment.ts`, `payment-uri.ts`, `client/confirming.ts`,
`client/wallet.ts`) is fully unit-tested with real fixtures (see
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
