import { writable } from 'svelte/store'
import { createWalletConnectProvider } from '@klappay/checkout-kit/client/walletconnect'
import type { Eip1193Provider } from '@klappay/checkout-kit/client'
import { env } from '$env/dynamic/public'

export function createWalletConnectStore(chainIds: number[]) {
  const uri = writable<string | null>(null)
  const connecting = writable(false)
  const error = writable<unknown>(null)

  let wc: Awaited<ReturnType<typeof createWalletConnectProvider>> | null = null

  async function connect(): Promise<Eip1193Provider | null> {
    connecting.set(true)
    error.set(null)
    uri.set(null)

    try {
      wc = await createWalletConnectProvider({
        projectId: env.PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
        chainIds,
        metadata: {
          name: 'Klap Checkout Kit — SvelteKit example',
          description: 'Example checkout built with @klappay/checkout-kit',
          url: window.location.origin,
          icons: [],
        },
      })
      wc.on('uri', (u) => uri.set(u))

      const provider = await wc.connect()
      uri.set(null)
      return provider
    } catch (e) {
      error.set(e)
      return null
    } finally {
      connecting.set(false)
    }
  }

  async function disconnect(): Promise<void> {
    await wc?.disconnect()
    wc = null
    uri.set(null)
    connecting.set(false)
    error.set(null)
  }

  return { uri, connecting, error, connect, disconnect }
}
