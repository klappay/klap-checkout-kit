# Framework examples

`@klappay/checkout-kit/client` is headless on purpose — every function
is plain JS/TS, no DOM/framework assumptions, no React (or anything
else) as a dependency of this package. That means it drops into
whatever you're already using: wrap `createWalletPayment()`'s
event-emitter (`.on()` returns an unsubscribe function) and
`watchCheckoutEvents()`'s `stop()` return in your framework's own
effect/cleanup primitive, and you have a fully reactive wallet flow.
The examples below (React, Vue, Svelte) are all type-checked against
this package's real build output, not illustrative pseudo-code.

`createWalletPayment()` tracks its own `WalletStatus`
(`'idle' | 'connecting' | 'paying' | 'sent' | 'error'`) and emits it on
a `'status'` event — see [Client](/client#connecting-a-wallet-and-paying).
None of the examples below hand-roll that state machine; they just
subscribe to it, same as `'account'`/`'sent'`/`'error'`.

`createSwapPayment()` (for [swap-to-pay](/client#swap-to-pay-paying-with-a-different-crypto))
has the identical `.on()`/`.getStatus()` shape, just with a longer
`SwapPaymentStatus` union and an extra `'approved'` event — every
pattern below applies to it unchanged, only the imported type/status
values differ.

Two more capabilities drop into the exact same `wallet.on(...)`/hook
shape below, framework-agnostic enough that they don't need a
per-framework example of their own — the runnable `examples/`
(nextjs/nuxt/sveltekit) show them wired into each framework's actual
hook/composable/store:

```ts
// Right after 'sent' — an instant on-chain re-check instead of
// waiting out the ~60s background reconciliation pass:
wallet.on('sent', (txHash) => {
  fetch(`/api/checkout/${payload.id}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash, network: option.network }),
  })
})

// Before connect() — let the payer pick among several installed
// wallet extensions instead of guessing at window.ethereum:
import { discoverProviders } from '@klappay/checkout-kit/client'
const providers = await discoverProviders() // [{ info: { name, icon, rdns }, provider }, ...]
```

See [Instant re-check](/node#instant-re-check-after-a-payers-transaction)
and [Multiple wallets installed](/client#connecting-a-wallet-and-paying)
for the full details of each.

## React

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createWalletPayment,
  isWalletPayable,
  watchCheckoutEvents,
} from '@klappay/checkout-kit/client'
import type { CheckoutPayload, PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

function useWalletPayment(option: PaymentOption | null, recipientAddress: string | undefined) {
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

function useCheckoutPayload(chargeId: string) {
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

Used in a component:

```tsx
function CheckoutButton({ chargeId }: { chargeId: string }) {
  const payload = useCheckoutPayload(chargeId)
  const option = payload?.paymentOptions.find(isWalletPayable) ?? null
  const { account, status, txHash, connect, pay } = useWalletPayment(option, payload?.address)

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

The pattern to notice: `wallet.on(...)` returns an unsubscribe function
per call, so `useEffect`'s cleanup is a direct, one-to-one mapping — no
manual event-target bookkeeping, and no local status state machine to
get subtly wrong (a rejected chain-switch prompt, for instance, still
correctly lands on `'error'` — that's handled once, inside `pay()`
itself). Same for `watchCheckoutEvents()`'s returned `stop()`.

## Vue

Composition API — the same unsubscribe-in-cleanup shape, just `ref()`
instead of `useState` and `onUnmounted` instead of a `useEffect`
cleanup return:

```ts
import { onUnmounted, ref } from 'vue'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

function useWalletPayment(option: PaymentOption, recipientAddress: string) {
  if (!isWalletPayable(option)) {
    throw new Error('Option is not wallet-payable')
  }

  const account = ref<string | null>(null)
  const status = ref<WalletStatus>('idle')
  const txHash = ref<string | null>(null)

  const wallet = createWalletPayment(option, recipientAddress)

  const offAccount = wallet.on('account', (a) => {
    account.value = a
  })
  const offStatus = wallet.on('status', (s) => {
    status.value = s
  })
  const offSent = wallet.on('sent', (hash) => {
    txHash.value = hash
  })

  onUnmounted(() => {
    offAccount()
    offStatus()
    offSent()
  })

  return { account, status, txHash, connect: wallet.connect, pay: wallet.pay }
}
```

```vue
<script setup lang="ts">
const props = defineProps<{ option: PaymentOption; address: string }>()
const { account, status, txHash, connect, pay } = useWalletPayment(props.option, props.address)
</script>

<template>
  <button v-if="!account" @click="connect">Connect wallet</button>
  <button v-else :disabled="status === 'paying'" @click="pay">
    {{ status === 'paying' ? 'Confirm in wallet…' : 'Pay now' }}
  </button>
  <p v-if="txHash">Sent: {{ txHash }}</p>
</template>
```

## Svelte

The store pattern (`svelte/store`, works the same in Svelte 4 and 5 —
runes are an alternative, not a replacement):

```ts
import { writable } from 'svelte/store'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

function createWalletStore(option: PaymentOption, recipientAddress: string) {
  if (!isWalletPayable(option)) {
    throw new Error('Option is not wallet-payable')
  }

  const account = writable<string | null>(null)
  const status = writable<WalletStatus>('idle')
  const txHash = writable<string | null>(null)

  const wallet = createWalletPayment(option, recipientAddress)
  wallet.on('account', (a) => account.set(a))
  wallet.on('status', (s) => status.set(s))
  wallet.on('sent', (hash) => txHash.set(hash))

  return { account, status, txHash, connect: wallet.connect, pay: wallet.pay }
}
```

```svelte
<script lang="ts">
  export let option: PaymentOption
  export let address: string
  const { account, status, txHash, connect, pay } = createWalletStore(option, address)
</script>

{#if !$account}
  <button on:click={connect}>Connect wallet</button>
{:else}
  <button on:click={pay} disabled={$status === 'paying'}>
    {$status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
  </button>
{/if}
{#if $txHash}<p>Sent: {$txHash}</p>{/if}
```

A component-scoped store (created inside the component, not a shared
module-level store) needs its own unsubscribe in `onDestroy` if the
component can unmount mid-payment — omitted above for brevity, same
`wallet.on()` return values as the React/Vue examples.

## Full-stack examples

The React hooks above assume `/api/checkout/:id` and
`/api/checkout/:id/events` routes already exist. See
[Full-stack examples](/examples) for those routes wired up end to end —
Hono (matching klap-checkout's own setup) and Next.js App Router.

## No framework, no bundler at all

Building against klap-checkout's own `hono/jsx` + zero-bundler
`public/*.js` setup, or anything similar? See
[No bundler? Use the script-tag build](/client#no-bundler-use-the-script-tag-build) —
`window.KlapCheckoutKit` exposes this exact same API without an
`import` anywhere.

## Plain JavaScript (no framework)

See [Full checkout flow](/checkout-flow) — the same `wallet.on()` /
`watchCheckoutEvents()` pattern above, without a framework's
reactivity system wrapping it; just `addEventListener`-style callbacks
directly.
