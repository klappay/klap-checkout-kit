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

    wallet.reconnect().then((existing) => {
      if (existing) setAccount(existing)
    })

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/checkout/${chargeId}`)
      .then(async (r) => {
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setError(data?.error ?? 'failed to load checkout')
          return
        }
        setPayload(data as CheckoutPayload)
      })
      .catch(() => {
        if (!cancelled) setError('failed to load checkout')
      })
    return () => {
      cancelled = true
    }
  }, [chargeId])

  useEffect(() => {
    const stop = watchCheckoutEvents(`/api/checkout/${chargeId}/events`, setPayload)
    return stop
  }, [chargeId])

  return { payload, error }
}
