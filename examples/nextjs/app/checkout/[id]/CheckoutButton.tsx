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
import type { ConfirmingRecord, Eip6963ProviderDetail, PaymentOption } from '@klappay/checkout-kit/client'
import { useCheckoutPayload, useDiscoveredProviders, useWalletPayment } from './hooks'
import { SwapAlternatives } from './SwapAlternatives'
import { useWalletConnectPayment } from './walletconnect-hooks'

export function CheckoutButton({ chargeId }: { chargeId: string }) {
  const { payload, error } = useCheckoutPayload(chargeId)
  const [selected, setSelected] = useState<PaymentOption | null>(null)
  const [confirming, setConfirming] = useState<ConfirmingRecord | null>(null)
  const discoveredProviders = useDiscoveredProviders()
  const [chosenProvider, setChosenProvider] = useState<Eip6963ProviderDetail | null>(null)

  const option = selected ?? payload?.paymentOptions[0] ?? null
  const walletPayable = option ? isWalletPayable(option) : false

  const { account, status, txHash, connect, pay } = useWalletPayment(
    walletPayable ? option : null,
    payload?.address,
    chosenProvider?.provider,
  )
  const walletConnect = useWalletConnectPayment(
    chargeId,
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

    fetch(`/api/checkout/${payload.id}/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ txHash, network: option.network }),
    }).catch((err) => console.error('checkCheckout failed', err))
  }, [payload, option, txHash])

  useEffect(() => {
    if (!payload || !option || !walletConnect.txHash) return
    saveConfirming(payload.id, option.network, walletConnect.txHash)
    setConfirming(getConfirming(payload.id))
  }, [payload, option, walletConnect.txHash])

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
          {discoveredProviders.length > 1 && !account && (
            <div>
              <p>Choose a wallet:</p>
              {discoveredProviders.map((p) => (
                <button
                  key={p.info.uuid}
                  onClick={() => setChosenProvider(p)}
                  disabled={p.info.uuid === chosenProvider?.info.uuid}
                >
                  {p.info.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.info.icon} alt="" width={20} height={20} />
                  )}
                  {p.info.name}
                </button>
              ))}
            </div>
          )}
          {!account ? (
            <button onClick={connect}>Connect wallet</button>
          ) : (
            <button onClick={pay} disabled={status === 'paying'}>
              {status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
            </button>
          )}
          {status === 'error' && <p>Something went wrong. Please try again.</p>}
          {txHash && <p>Sent: {txHash}</p>}

          {walletConnect.available && (
            <div>
              <p>Or pay with a wallet app instead of a browser extension:</p>
              {!walletConnect.account ? (
                <button onClick={walletConnect.connect} disabled={walletConnect.status === 'connecting'}>
                  {walletConnect.status === 'connecting' ? 'Connecting…' : 'Pay with WalletConnect'}
                </button>
              ) : (
                <>
                  <button onClick={walletConnect.pay} disabled={walletConnect.status === 'paying'}>
                    {walletConnect.status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
                  </button>
                  <button onClick={walletConnect.disconnect}>Disconnect</button>
                </>
              )}
              {walletConnect.uri && (
                <p>
                  Scan or open with your wallet app: <code>{walletConnect.uri}</code>
                </p>
              )}
              {walletConnect.error != null && <p>WalletConnect payment failed. Please try again.</p>}
              {walletConnect.txHash && <p>Sent: {walletConnect.txHash}</p>}
            </div>
          )}
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
