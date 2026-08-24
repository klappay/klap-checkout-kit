import { browser } from '$app/environment'
import { writable } from 'svelte/store'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { Eip1193Provider, PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

export function createWalletStore(
  chargeId: string,
  option: PaymentOption,
  recipientAddress: string,
  provider?: Eip1193Provider,
) {
  if (!isWalletPayable(option)) {
    throw new Error('Option is not wallet-payable')
  }

  const account = writable<string | null>(null)
  const status = writable<WalletStatus>('idle')
  const txHash = writable<string | null>(null)
  const error = writable<unknown>(null)

  const wallet = browser ? createWalletPayment(option, recipientAddress, provider) : null
  wallet?.on('account', (a) => account.set(a))
  wallet?.on('status', (s) => status.set(s))
  wallet?.on('sent', (hash) => {
    txHash.set(hash)

    // Trigger an immediate on-chain re-check instead of waiting out the
    // ~60s background reconciliation pass — the SSE stream still picks
    // up the result either way.
    fetch(`/api/checkout/${chargeId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash: hash, network: option.network }),
    }).catch((e) => console.error('checkCheckout failed', e))
  })
  wallet?.on('error', (e) => error.set(e))

  return {
    account,
    status,
    txHash,
    error,
    connect: () => wallet?.connect(),
    pay: () => wallet?.pay(),
    reconnect: () => wallet?.reconnect(),
  }
}
