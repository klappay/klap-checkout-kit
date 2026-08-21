import { writable } from 'svelte/store'
import { createSwapPayment, getInjectedProvider, saveConfirming } from '@klappay/checkout-kit/client'
import type { SwapAlternative, SwapPaymentStatus, SwapQuote } from '@klappay/checkout-kit/client'

export function createSwapStore(chargeId: string) {
  const status = writable<SwapPaymentStatus>('idle')
  const txHash = writable<string | null>(null)
  const error = writable<unknown>(null)

  async function pay(alt: SwapAlternative) {
    error.set(null)
    txHash.set(null)

    const provider = getInjectedProvider()
    if (!provider) {
      error.set(new Error('No EIP-1193 wallet provider found.'))
      return
    }

    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    const takerAddress = accounts[0]
    if (!takerAddress) return

    const res = await fetch(`/api/checkout/${chargeId}/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputToken: alt.token, inputNetwork: alt.network, takerAddress }),
    })
    const data: SwapQuote | { error: string } = await res.json()
    if (!res.ok || 'error' in data) {
      error.set(new Error('error' in data ? data.error : 'failed to get a swap quote'))
      return
    }

    const swap = createSwapPayment(data, provider)
    swap.on('status', (s) => status.set(s))
    swap.on('sent', (hash) => {
      txHash.set(hash)
      saveConfirming(chargeId, alt.network, hash)
    })
    swap.on('error', (e) => error.set(e))

    await swap.connect()
    await swap.pay()
  }

  return { status, txHash, error, pay }
}
