---
"@klappay/checkout-kit": patch
---

Bumps `@klappay/node` to `^3.4.1` and `@klappay/types` to `^3.5.1`,
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
