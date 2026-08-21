import { ref } from 'vue'
import { createSwapPayment, getInjectedProvider } from '@klappay/checkout-kit/client'
import type { SwapAlternative, SwapPaymentStatus, SwapQuote } from '@klappay/checkout-kit/client'

export function useSwapPayment(chargeId: string) {
  const status = ref<SwapPaymentStatus>('idle')
  const txHash = ref<string | null>(null)
  const error = ref<unknown>(null)

  async function pay(alt: SwapAlternative) {
    error.value = null
    txHash.value = null

    const provider = getInjectedProvider()
    if (!provider) {
      error.value = new Error('No EIP-1193 wallet provider found.')
      return
    }

    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
    const takerAddress = accounts[0]
    if (!takerAddress) return

    const quote = await $fetch<SwapQuote>(`/api/checkout/${chargeId}/quote`, {
      method: 'POST',
      body: { inputToken: alt.token, inputNetwork: alt.network, takerAddress },
    }).catch((err) => {
      error.value = err
      return null
    })
    if (!quote) return

    const swap = createSwapPayment(quote, provider)
    swap.on('status', (s) => {
      status.value = s
    })
    swap.on('sent', (hash) => {
      txHash.value = hash
    })
    swap.on('error', (e) => {
      error.value = e
    })

    await swap.connect()
    await swap.pay()
  }

  return { status, txHash, error, pay }
}
