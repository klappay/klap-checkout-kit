import { ref } from 'vue'
import { createWalletPayment } from '@klappay/checkout-kit/client'
import type { PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'
import type { createWalletConnectProvider } from '@klappay/checkout-kit/client/walletconnect'

export function useWalletConnectPayment(option: PaymentOption, recipientAddress: string) {
  if (option.chainId === null) {
    throw new Error('Option is not wallet-payable')
  }
  const chainId = option.chainId

  const account = ref<string | null>(null)
  const status = ref<WalletStatus | 'awaiting-pairing'>('idle')
  const txHash = ref<string | null>(null)
  const error = ref<unknown>(null)
  const uri = ref<string | null>(null)
  let wcHandle: Awaited<ReturnType<typeof createWalletConnectProvider>> | null = null

  async function connect() {
    if (!import.meta.client) return
    error.value = null
    status.value = 'awaiting-pairing'

    try {
      const { createWalletConnectProvider } = await import('@klappay/checkout-kit/client/walletconnect')
      const config = useRuntimeConfig()

      const wc = await createWalletConnectProvider({
        projectId: config.public.walletConnectProjectId,
        chainIds: [chainId],
        metadata: {
          name: 'Klap Checkout Kit — Nuxt example',
          description: 'Example checkout built with @klappay/checkout-kit',
          url: window.location.origin,
          icons: [],
        },
      })
      wcHandle = wc
      wc.on('uri', (u) => {
        uri.value = u
      })

      const provider = await wc.connect()
      uri.value = null

      const wallet = createWalletPayment(option, recipientAddress, provider)
      wallet.on('account', (a) => {
        account.value = a
      })
      wallet.on('status', (s) => {
        status.value = s
      })
      wallet.on('sent', (hash) => {
        txHash.value = hash
      })
      wallet.on('error', (e) => {
        error.value = e
      })

      await wallet.connect()
      await wallet.pay()
    } catch (e) {
      status.value = 'error'
      error.value = e
    }
  }

  async function disconnect() {
    await wcHandle?.disconnect()
    wcHandle = null
    account.value = null
    status.value = 'idle'
    txHash.value = null
    error.value = null
    uri.value = null
  }

  return { account, status, txHash, error, uri, connect, disconnect }
}
