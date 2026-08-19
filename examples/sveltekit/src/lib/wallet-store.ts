import { writable } from 'svelte/store'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

export function createWalletStore(option: PaymentOption, recipientAddress: string) {
  if (!isWalletPayable(option)) {
    throw new Error('Option is not wallet-payable')
  }

  const account = writable<string | null>(null)
  const status = writable<WalletStatus>('idle')
  const txHash = writable<string | null>(null)
  const error = writable<unknown>(null)

  const wallet = createWalletPayment(option, recipientAddress)
  wallet.on('account', (a) => account.set(a))
  wallet.on('status', (s) => status.set(s))
  wallet.on('sent', (hash) => txHash.set(hash))
  wallet.on('error', (e) => error.set(e))

  return {
    account,
    status,
    txHash,
    error,
    connect: wallet.connect,
    pay: wallet.pay,
    reconnect: wallet.reconnect,
  }
}
