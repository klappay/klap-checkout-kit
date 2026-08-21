# Examples

Runnable integrations, one per app shape — not snippets to read, apps to
clone and `pnpm install && pnpm dev`. For inline code walkthroughs
(read without cloning anything), see
[`docs/checkout-flow.md`](../docs/checkout-flow.md) and
[`docs/examples.md`](../docs/examples.md) instead.

| Example | Demonstrates |
| --- | --- |
| [`hono/`](./hono) | No bundler at all — plain `<script>` tags on the client, zero frontend build step (mirrors klap-checkout's own setup) |
| [`nextjs/`](./nextjs) | Next.js App Router — Route Handlers + React Client Components |
| [`sveltekit/`](./sveltekit) | SvelteKit — `+server.ts` routes + a `svelte/store`-based wallet store |
| [`nuxt/`](./nuxt) | Nuxt — Nitro server routes + a Vue Composition API composable |

Each app is fully standalone — none of them are part of a pnpm
workspace with the root package, and each has its own `package.json`
and lockfile-free `pnpm install`.

## Bring your own `KLAP_API_KEY`/`KLAP_BASE_URL`

Every example calls `createCheckoutKit({ apiKey, baseUrl })`
(`@klappay/checkout-kit/node`), which talks to Core's public,
API-key-authenticated `/v1` surface — same access any external
merchant integration has. None of them use klap-checkout's own
internal, unscoped, shared-secret route (`/internal/charges/*`, only
reachable service-to-service between klap-checkout and klap-core) that
lets it render *any* merchant's charge for its hosted `/c/:id` page.
That means each example only ever sees charges created under the
`KLAP_API_KEY` you provide — set it (and `KLAP_BASE_URL`) before
running, per each example's own README, or every charge lookup 404s.

## `@klappay/checkout-kit` is always `"latest"`

Every example depends on `"@klappay/checkout-kit": "latest"` — the npm
dist-tag, not a pinned version — on purpose. No `pnpm-lock.yaml` is
committed under `examples/*` either. That means every `pnpm install`
here re-resolves to whatever is actually published on npm right now,
so these examples double as a live integration check of real releases,
not a snapshot that quietly drifts from what a fresh install actually
gets.

**Testing local, unpublished changes before you push:** build the
package first (`pnpm build` at the repo root), then from inside an
example run `pnpm link ../../` to point `@klappay/checkout-kit` at that
local build instead of the npm-published version. Run
`pnpm unlink @klappay/checkout-kit && pnpm install` afterward to
restore the real published version — every example's `package.json`
should always read `"latest"` when committed, never a `link:`/`file:`
dependency.

## CI

`.github/workflows/ci.yml`'s `examples` job installs and
typechecks/builds each app on every push — no deploy, just a
correctness check (and, since nothing is pinned, an early warning if a
real release breaks one of these).

It tries the published `latest` first. That's the real signal described
above — when it passes, the example genuinely works against what's
installable today. When a change has landed on `main` but its
"Version Packages" PR hasn't been merged yet (the normal state in
between), `latest` doesn't have what the example needs yet, which would
otherwise fail CI for a reason that has nothing to do with the example's
own code. CI logs a `::notice::` and falls back to building
`@klappay/checkout-kit` from source and `pnpm link`-ing it in — the same
manual steps described above — before trying again. If it still fails
after that, it's a real bug in the example.
