import { onUnmounted, ref } from 'vue'
import { createWalletPayment, isWalletPayable } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'

export function useWalletPayment(option: PaymentOption, recipientAddress: string) {
  if (!isWalletPayable(option)) {
    throw new Error('Option is not wallet-payable')
  }

  const account = ref<string | null>(null)
  const status = ref<WalletStatus>('idle')
  const txHash = ref<string | null>(null)
  const error = ref<unknown>(null)

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
  const offError = wallet.on('error', (e) => {
    error.value = e
  })

  onUnmounted(() => {
    offAccount()
    offStatus()
    offSent()
    offError()
  })

  return {
    account,
    status,
    txHash,
    error,
    connect: wallet.connect,
    reconnect: wallet.reconnect,
    pay: wallet.pay,
  }
}
