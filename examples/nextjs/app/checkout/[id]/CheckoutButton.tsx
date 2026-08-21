'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildPaymentUri,
  clearConfirming,
  confirmingExplorerUrl,
  getConfirming,
  isWalletPayable,
  remainingMs,
  resolveRedirectUrl,
  saveConfirming,
} from '@klappay/checkout-kit/client'
import type { ConfirmingRecord, PaymentOption } from '@klappay/checkout-kit/client'
import { useCheckoutPayload, useWalletPayment } from './hooks'
import { SwapAlternatives } from './SwapAlternatives'

export function CheckoutButton({ chargeId }: { chargeId: string }) {
  const { payload, error } = useCheckoutPayload(chargeId)
  const [selected, setSelected] = useState<PaymentOption | null>(null)
  const [confirming, setConfirming] = useState<ConfirmingRecord | null>(null)

  const option = selected ?? payload?.paymentOptions[0] ?? null
  const walletPayable = option ? isWalletPayable(option) : false

  const { account, status, txHash, connect, pay } = useWalletPayment(
    walletPayable ? option : null,
    payload?.address,
  )

  useEffect(() => {
    if (!payload) return
    const record = getConfirming(payload.id)
    if (record) setConfirming(record)
  }, [payload?.id])

  useEffect(() => {
    if (!payload || !option || !txHash) return
    saveConfirming(payload.id, option.network, txHash)
    setConfirming(getConfirming(payload.id))
  }, [payload, option, txHash])

  useEffect(() => {
    if (!payload) return
    if (payload.status === 'confirmed') {
      clearConfirming(payload.id)
      const url = resolveRedirectUrl(payload.redirectUrl)
      if (url) {
        window.location.href = url
        return
      }
    }
    if (payload.status === 'expired' || payload.status === 'underpaid') {
      clearConfirming(payload.id)
    }
  }, [payload])

  const paymentUri = useMemo(() => {
    if (!payload || !option || !walletPayable) return null
    try {
      return buildPaymentUri(option, payload.address)
    } catch {
      return null
    }
  }, [payload, option, walletPayable])

  if (error) return <p>Failed to load checkout: {error}</p>
  if (!payload) return <p>Loading…</p>

  if (payload.status === 'confirmed') return <p>Payment confirmed. Redirecting…</p>
  if (payload.status === 'expired') return <p>This charge has expired.</p>
  if (payload.status === 'underpaid') return <p>This charge was underpaid.</p>

  if (!option) return <p>No payment options available for this charge.</p>

  return (
    <div>
      <p>
        Pay {payload.amount} {payload.currency} via {option.token} on {option.network}
      </p>

      {payload.paymentOptions.length > 1 && (
        <div>
          {payload.paymentOptions.map((opt) => (
            <button
              key={`${opt.token}-${opt.network}`}
              onClick={() => setSelected(opt)}
              disabled={opt === option}
            >
              {opt.token} / {opt.network}
            </button>
          ))}
        </div>
      )}

      {confirming ? (
        <div>
          <p>Payment sent, waiting for confirmation…</p>
          <p>Time remaining: {Math.max(0, Math.round(remainingMs(confirming) / 1000))}s</p>
          {confirmingExplorerUrl(confirming) && (
            <p>
              <a href={confirmingExplorerUrl(confirming)!} target="_blank" rel="noreferrer">
                View transaction
              </a>
            </p>
          )}
        </div>
      ) : walletPayable ? (
        <div>
          {!account ? (
            <button onClick={connect}>Connect wallet</button>
          ) : (
            <button onClick={pay} disabled={status === 'paying'}>
              {status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
            </button>
          )}
          {status === 'error' && <p>Something went wrong. Please try again.</p>}
          {txHash && <p>Sent: {txHash}</p>}
        </div>
      ) : (
        <div>
          <p>No wallet mapping for this network — send payment directly:</p>
          <p>
            <code>{payload.address}</code>
          </p>
          {paymentUri && (
            <p>
              <code>{paymentUri}</code>
            </p>
          )}
        </div>
      )}

      <SwapAlternatives payload={payload} />
    </div>
  )
}
