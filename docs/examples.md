# Full-stack examples

Complete integrations — server routes (`/node`) and client wiring
(`/client`) together — for two concrete stacks. Both are type-checked
against this package's real build output and the real framework's
types, not illustrative pseudo-code.

Want to clone and run one instead of reading it here? See
[`examples/`](https://github.com/klappay/klap-checkout-kit/tree/main/examples)
in the repo — four standalone, `pnpm install && pnpm dev`-ready apps
covering Hono (no bundler at all), Next.js, SvelteKit, and Nuxt. Each
always depends on `@klappay/checkout-kit`'s `latest` npm release, so
they double as a live integration check, not a frozen snapshot. All
four also demonstrate [instant re-check](/node#instant-re-check-after-a-payers-transaction)
and [EIP-6963 multi-wallet discovery](/client#connecting-a-wallet-and-paying);
`nextjs`/`nuxt`/`sveltekit` additionally demonstrate
[WalletConnect](/client#walletconnect-for-a-payer-with-a-wallet-app-not-an-extension)
(the `hono` example can't — see its own README for why).

## Hono

Mirrors klap-checkout's own `src/app.tsx` — same `serveStatic`,
`streamSSE`, and abort-signal wiring it already uses for `./public`,
just pointed at `@klappay/checkout-kit` instead of hand-rolled logic:

```ts
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { KlapApiError } from '@klappay/node'
import {
  constructWebhookEvent,
  createCheckoutKit,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'

const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})

const app = new Hono()

// The IIFE build, served straight from node_modules — always matches
// whatever version is actually installed, no copying into ./public.
app.use(
  '/vendor/checkout-kit/*',
  serveStatic({
    root: './node_modules/@klappay/checkout-kit/dist/client',
    rewriteRequestPath: (path) => path.replace(/^\/vendor\/checkout-kit/, ''),
  }),
)

app.get('/api/checkout/:id', async (c) => {
  try {
    const payload = await checkout.getCheckoutPayload(c.req.param('id'))
    return c.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return c.json({ error: 'charge not found' }, 404)
    }
    throw err
  }
})

app.get('/api/checkout/:id/events', (c) => {
  return streamSSE(c, async (stream) => {
    const controller = new AbortController()
    stream.onAbort(() => controller.abort())

    for await (const payload of checkout.watchCheckout(c.req.param('id'), controller.signal)) {
      await stream.writeSSE({ event: 'charge', data: JSON.stringify(payload) })
    }
  })
})

app.post('/api/checkout/:id/check', async (c) => {
  const input = await c.req.json().catch(() => undefined)
  const payload = await checkout.checkCheckout(c.req.param('id'), input)
  return c.json(payload)
})

app.post('/webhooks/klap', async (c) => {
  const rawBody = await c.req.text()
  const signature = c.req.header('x-klappay-signature')
  if (!signature) return c.text('Missing signature', 400)

  try {
    const event = constructWebhookEvent(rawBody, signature, process.env.KLAP_WEBHOOK_SECRET!)
    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge
    }
    return c.text('ok', 200)
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) return c.text('stale delivery', 400)
    if (err instanceof InvalidWebhookSignatureError) return c.text('invalid signature', 400)
    throw err
  }
})

export { app }
```

`stream.onAbort(() => controller.abort())` matters — without it, a
payer closing the tab leaves `watchCheckout()`'s underlying
`@klappay/node` SSE connection to Core open indefinitely. Passing that
same signal into `checkout.watchCheckout(id, controller.signal)` is
what actually tears it down.

Client-side markup (no bundler — this is klap-checkout's own
zero-build `public/*.js` setup) points at the route above:

```html
<script src="/vendor/checkout-kit/index.global.js"></script>
<script>
  const wallet = KlapCheckoutKit.createWalletPayment(option, payload.address)
  wallet.on('status', (status) => { /* update UI */ })
  wallet.on('sent', (txHash) => {
    /* show confirming state */
    fetch(`/api/checkout/${payload.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, network: option.network }),
    })
  })
  await wallet.connect()
  await wallet.pay()
</script>
```

See [No bundler? Use the script-tag build](/client#no-bundler-use-the-script-tag-build)
for the full API surface available on `window.KlapCheckoutKit`.

Swap-to-pay (`public/swap.js` in the repo) follows the same
script-tag pattern — a `POST /api/checkout/:id/quote` route added
alongside the one above, and `KlapCheckoutKit.createSwapPayment(quote)`
on the client. See [Swap-to-pay](/node#swap-to-pay-paying-with-a-different-crypto)
for the full quote shape and [the client side](/client#swap-to-pay-paying-with-a-different-crypto)
for the wallet-signing flow — both apply unchanged whether loaded via
`<script>` or `import`.

## Next.js (App Router)

Route Handlers for the server half, a Client Component for the wallet
UI. `lib/checkout-kit.ts`:

```ts
import { createCheckoutKit } from '@klappay/checkout-kit/node'

export const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})
```

`app/api/checkout/[id]/route.ts`:

```ts
import { KlapApiError } from '@klappay/node'
import { NextResponse } from 'next/server'
import { checkout } from '@/lib/checkout-kit'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const payload = await checkout.getCheckoutPayload(id)
    return NextResponse.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return NextResponse.json({ error: 'charge not found' }, { status: 404 })
    }
    throw err
  }
}
```

`app/api/checkout/[id]/events/route.ts` — Next.js has no `streamSSE`
helper, so the SSE framing is built directly from a `ReadableStream`;
`req.signal` (aborted when the client disconnects) is passed straight
into `watchCheckout()`, same role as Hono's `controller.signal` above:

```ts
import { checkout } from '@/lib/checkout-kit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const payload of checkout.watchCheckout(id, req.signal)) {
          controller.enqueue(encoder.encode(`event: charge\ndata: ${JSON.stringify(payload)}\n\n`))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

`app/api/checkout/[id]/check/route.ts` — an instant on-chain re-check,
called right after a wallet transaction is sent (see `CheckoutButton.tsx`
below) instead of waiting out the ~60s background reconciliation pass:

```ts
import { NextResponse } from 'next/server'
import { checkout } from '@/lib/checkout-kit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const input = await req.json().catch(() => undefined)
  const payload = await checkout.checkCheckout(id, input)
  return NextResponse.json(payload)
}
```

`app/api/webhooks/klap/route.ts` — same `constructWebhookEvent()` as
the Hono example:

```ts
import {
  constructWebhookEvent,
  InvalidWebhookSignatureError,
  WebhookTimestampToleranceError,
} from '@klappay/checkout-kit/node'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-klappay-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  try {
    const event = constructWebhookEvent(rawBody, signature, process.env.KLAP_WEBHOOK_SECRET!)
    if (event.event.startsWith('charge.')) {
      // event.data is a fully-typed Charge
    }
    return new Response('ok', { status: 200 })
  } catch (err) {
    if (err instanceof WebhookTimestampToleranceError) return new Response('stale delivery', { status: 400 })
    if (err instanceof InvalidWebhookSignatureError) return new Response('invalid signature', { status: 400 })
    throw err
  }
}
```

`app/checkout/[id]/hooks.ts` — the same `useWalletPayment`/
`useCheckoutPayload` hooks from [Framework examples](/frameworks#react),
in their own `'use client'` module (App Router Server Components can't
call `useState`/`useEffect` — the hooks and anything importing
`@klappay/checkout-kit/client` need this boundary):

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createWalletPayment,
  isWalletPayable,
  watchCheckoutEvents,
} from '@klappay/checkout-kit/client'
import type { CheckoutPayload, PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

export function useWalletPayment(option: PaymentOption | null, recipientAddress: string | undefined) {
  const [account, setAccount] = useState<string | null>(null)
  const [status, setStatus] = useState<WalletStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const walletRef = useRef<ReturnType<typeof createWalletPayment> | null>(null)

  useEffect(() => {
    if (!option || !recipientAddress || !isWalletPayable(option)) {
      walletRef.current = null
      return
    }
    const wallet = createWalletPayment(option, recipientAddress)
    walletRef.current = wallet

    const offAccount = wallet.on('account', setAccount)
    const offStatus = wallet.on('status', setStatus)
    const offSent = wallet.on('sent', setTxHash)
    const offError = wallet.on('error', setError)

    return () => {
      offAccount()
      offStatus()
      offSent()
      offError()
    }
  }, [option, recipientAddress])

  const connect = useCallback(() => walletRef.current?.connect(), [])
  const pay = useCallback(() => walletRef.current?.pay(), [])

  return { account, status, txHash, error, connect, pay }
}

export function useCheckoutPayload(chargeId: string) {
  const [payload, setPayload] = useState<CheckoutPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/checkout/${chargeId}`)
      .then((r) => r.json())
      .then((data: CheckoutPayload) => {
        if (!cancelled) setPayload(data)
      })
    return () => {
      cancelled = true
    }
  }, [chargeId])

  useEffect(() => {
    const stop = watchCheckoutEvents(`/api/checkout/${chargeId}/events`, setPayload)
    return stop
  }, [chargeId])

  return payload
}
```

`app/checkout/[id]/CheckoutButton.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { isWalletPayable, resolveRedirectUrl } from '@klappay/checkout-kit/client'
import { useCheckoutPayload, useWalletPayment } from './hooks'

export function CheckoutButton({ chargeId }: { chargeId: string }) {
  const payload = useCheckoutPayload(chargeId)
  const option = payload?.paymentOptions.find(isWalletPayable) ?? null
  const { account, status, txHash, connect, pay } = useWalletPayment(option, payload?.address)

  useEffect(() => {
    if (!payload || !option || !txHash) return
    // An instant on-chain re-check instead of waiting out the ~60s
    // background reconciliation pass.
    fetch(`/api/checkout/${payload.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, network: option.network }),
    }).catch((err) => console.error('checkCheckout failed', err))
  }, [payload, option, txHash])

  useEffect(() => {
    if (payload?.status === 'confirmed') {
      const url = resolveRedirectUrl(payload.redirectUrl)
      if (url) window.location.href = url
    }
  }, [payload])

  if (!payload || !option) return <p>Loading…</p>

  return (
    <div>
      <p>
        Pay {payload.amount} via {option.token} on {option.network}
      </p>
      {!account ? (
        <button onClick={connect}>Connect wallet</button>
      ) : (
        <button onClick={pay} disabled={status === 'paying'}>
          {status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
        </button>
      )}
      {txHash && <p>Sent: {txHash}</p>}
    </div>
  )
}
```

`app/checkout/[id]/page.tsx` — a Server Component, only responsible for
reading the route param and rendering the client boundary:

```tsx
import { CheckoutButton } from './CheckoutButton'

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CheckoutButton chargeId={id} />
}
```

Swap-to-pay adds one more Route Handler
(`app/api/checkout/[id]/quote/route.ts`, calling
`checkout.getSwapQuote()`) plus a `swap-hooks.ts` +
`SwapAlternatives.tsx` pair mirroring `hooks.ts`/`CheckoutButton.tsx`
above — same `useState`/`useCallback`/event-emitter shape, just against
`createSwapPayment()` instead of `createWalletPayment()`. See
[Swap-to-pay](/node#swap-to-pay-paying-with-a-different-crypto) for the
quote shape and [the client side](/client#swap-to-pay-paying-with-a-different-crypto)
for the full signing flow, or the repo's `examples/nextjs/` for the
complete files.
```
