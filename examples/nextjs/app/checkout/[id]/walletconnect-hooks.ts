'use client'

import { useCallback, useRef, useState } from 'react'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'
import { createWalletConnectProvider } from '@klappay/checkout-kit/client/walletconnect'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export function useWalletConnectPayment(
  chargeId: string,
  option: PaymentOption | null,
  recipientAddress: string | undefined,
) {
  const [uri, setUri] = useState<string | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [status, setStatus] = useState<WalletStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const walletRef = useRef<ReturnType<typeof createWalletPayment> | null>(null)

  const connect = useCallback(async () => {
    if (!projectId || !option || !recipientAddress || !isWalletPayable(option)) return
    if (option.chainId === null) return

    setError(null)
    setUri(null)

    try {
      const wc = await createWalletConnectProvider({
        projectId,
        chainIds: [option.chainId],
        metadata: {
          name: 'Klap Checkout Kit — Next.js example',
          description: 'Example checkout built with @klappay/checkout-kit',
          url: window.location.origin,
          icons: [],
        },
      })
      wc.on('uri', setUri)

      const provider = await wc.connect()
      setUri(null)

      const wallet = createWalletPayment(option, recipientAddress, provider)
      walletRef.current = wallet
      wallet.on('account', setAccount)
      wallet.on('status', setStatus)
      wallet.on('sent', (hash) => {
        setTxHash(hash)
        fetch(`/api/checkout/${chargeId}/check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ txHash: hash, network: option.network }),
        }).catch((err) => console.error('checkCheckout failed', err))
      })
      wallet.on('error', setError)

      await wallet.connect()
    } catch (err) {
      setError(err)
    }
  }, [chargeId, option, recipientAddress])

  const pay = useCallback(() => walletRef.current?.pay(), [])

  return { available: Boolean(projectId), uri, account, status, txHash, error, connect, pay }
}
