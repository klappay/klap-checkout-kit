'use client'

import { useCallback, useRef, useState } from 'react'
import { createSwapPayment, getInjectedProvider, saveConfirming } from '@klappay/checkout-kit/client'
import type { SwapAlternative, SwapPaymentStatus, SwapQuote } from '@klappay/checkout-kit/client'

export function useSwapPayment(chargeId: string) {
  const [status, setStatus] = useState<SwapPaymentStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const swapRef = useRef<ReturnType<typeof createSwapPayment> | null>(null)

  const pay = useCallback(
    async (alt: SwapAlternative) => {
      setError(null)
      setTxHash(null)

      const provider = getInjectedProvider()
      if (!provider) {
        setError(new Error('No EIP-1193 wallet provider found.'))
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
        setError(new Error('error' in data ? data.error : 'failed to get a swap quote'))
        return
      }

      const swap = createSwapPayment(data, provider)
      swapRef.current = swap
      swap.on('status', setStatus)
      swap.on('sent', (hash) => {
        setTxHash(hash)
        saveConfirming(chargeId, alt.network, hash)
        fetch(`/api/checkout/${chargeId}/check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ txHash: hash, network: alt.network }),
        }).catch((err) => console.error('checkCheckout failed', err))
      })
      swap.on('error', setError)

      await swap.connect()
      await swap.pay()
    },
    [chargeId],
  )

  return { status, txHash, error, pay }
}
