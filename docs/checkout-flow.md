# Full checkout flow

Everything from the other pages, wired together into one connect → pay
→ confirm flow. Framework-agnostic on purpose — this example uses plain
`fetch`/DOM to stay implementation-neutral; swap in your own
framework's equivalents.

## 1. Create the charge (out of scope for this package)

Charge creation belongs to `@klappay/node` directly, on your backend —
this package starts from an existing `chargeId`:

```ts
import { createClient } from '@klappay/node'

const klap = createClient({ apiKey: process.env.KLAP_API_KEY!, baseUrl: process.env.KLAP_BASE_URL! })

const charge = await klap.charges.create({
  amount: 49.9,
  acceptedPayments: [{ token: 'USDC', network: 'base' }],
  expiresIn: 3600,
  redirectUrl: 'https://your-store.com/orders/1234/thank-you',
})
```

## 2. Expose a checkout route

```ts
import { KlapApiError } from '@klappay/node'
import { createCheckoutKit } from '@klappay/checkout-kit/node'

const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})

app.get('/api/checkout/:id', async (c) => {
  try {
    return c.json(await checkout.getCheckoutPayload(c.req.param('id')))
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return c.json({ error: 'charge not found' }, 404)
    }
    throw err
  }
})

app.get('/api/checkout/:id/events', async (c) => {
  return streamSSE(c, async (stream) => {
    for await (const payload of checkout.watchCheckout(c.req.param('id'))) {
      await stream.writeSSE({ event: 'charge', data: JSON.stringify(payload) })
    }
  })
})
```

## 3. Render payment options in the browser

```ts
import { buildPaymentUri, isWalletPayable } from '@klappay/checkout-kit/client'

const payload = await fetch(`/api/checkout/${chargeId}`).then((r) => r.json())

for (const option of payload.paymentOptions) {
  if (isWalletPayable(option)) {
    renderWalletButton(option) // your own UI
  } else {
    renderQrCode(buildPaymentUri(option, payload.address)) // or just render payload.address as text
  }
}
```

## 4. Pay with a connected wallet

```ts
import { createWalletPayment, saveConfirming } from '@klappay/checkout-kit/client'

async function onWalletButtonClick(option) {
  const wallet = createWalletPayment(option, payload.address)

  wallet.on('sent', (txHash) => {
    saveConfirming(payload.id, option.network, txHash)
    showConfirmingState(txHash)
  })
  wallet.on('error', (error) => {
    if (error.code === 4001) showRejectedState()
    else showGenericErrorState(error)
  })

  await wallet.connect()
  await wallet.pay()
}
```

## 4b. Or pay with a different crypto (swap-to-pay)

```ts
app.post('/api/checkout/:id/quote', async (c) => {
  const input = await c.req.json() // { inputToken, inputNetwork, takerAddress }
  return c.json(await checkout.getSwapQuote(c.req.param('id'), input))
})
```

```ts
import { createSwapPayment } from '@klappay/checkout-kit/client'

async function onSwapButtonClick(alt) {
  // alt is one of payload.swapAlternatives — { token, network }
  const account = await wallet.reconnect() // or connect() — same wallet requests the quote and pays it
  const quote = await fetch(`/api/checkout/${payload.id}/quote`, {
    method: 'POST',
    body: JSON.stringify({ inputToken: alt.token, inputNetwork: alt.network, takerAddress: account }),
  }).then((r) => r.json())

  const swap = createSwapPayment(quote)
  swap.on('sent', (txHash) => {
    saveConfirming(payload.id, quote.outputNetwork, txHash)
    showConfirmingState(txHash)
  })
  swap.on('error', (error) => {
    if (error.code === 4001) showRejectedState()
    else showGenericErrorState(error)
  })

  await swap.connect()
  await swap.pay() // approves Permit2 first if quote.permit2 is present and not yet allowed
}
```

Same `payload.id`/`saveConfirming()`/step 5 below either way — a
swap-to-pay transaction still lands on `payload.address` as a normal
credited transfer, indistinguishable from a direct wallet payment once
it confirms. See [Swap-to-pay](/client#swap-to-pay-paying-with-a-different-crypto)
for the full status machine.

## 5. Watch for confirmation

```ts
import { isOpenStatus, resolveRedirectUrl, watchCheckoutEvents, clearConfirming } from '@klappay/checkout-kit/client'

const stop = watchCheckoutEvents(`/api/checkout/${payload.id}/events`, (updated) => {
  if (isOpenStatus(updated.status)) return // still 'pending'/'partially_paid', keep waiting

  stop()
  clearConfirming(updated.id)

  if (updated.status === 'confirmed') {
    const url = resolveRedirectUrl(updated.redirectUrl)
    if (url) window.location.href = url
    else showConfirmedState(updated)
  } else {
    showTerminalState(updated) // 'expired' or 'underpaid'
  }
})
```

## 6. On page reload, before the SSE reconnects

```ts
import { getConfirming, remainingMs } from '@klappay/checkout-kit/client'

const record = getConfirming(payload.id)
if (record) {
  showConfirmingState(record.txHash, remainingMs(record))
}
```

That's the whole loop: a payer never leaves your site, every step uses
data your own backend already has, and the only things you had to
build are the render functions (`renderWalletButton`,
`showConfirmingState`, etc.) — the styling and framework are entirely
yours.
