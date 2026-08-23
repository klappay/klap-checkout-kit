---
"@klappay/checkout-kit": patch
---

Fixes a bug introduced in `1.2.0`: `src/client/permit2.ts` and
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
