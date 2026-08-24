import { UniversalProvider } from '@walletconnect/universal-provider'
import type UniversalProviderInstance from '@walletconnect/universal-provider'
import type { Metadata } from '@walletconnect/universal-provider'
import { createEmitter } from './emitter'
import type { Eip1193Provider } from './wallet'

export type WalletConnectMetadata = Metadata

export type WalletConnectProviderOptions = {
  projectId: string
  chainIds: number[]
  metadata: WalletConnectMetadata
}

export type WalletConnectProviderEvents = {
  uri: (uri: string) => void
}

const REQUESTED_METHODS = ['eth_sendTransaction', 'eth_signTypedData_v4']
const REQUESTED_EVENTS = ['chainChanged', 'accountsChanged']

function toEip1193Provider(universalProvider: UniversalProviderInstance): Eip1193Provider {
  return {
    async request({ method, params }) {
      const result = await universalProvider.request({ method, params })
      return method === 'eth_chainId' ? `0x${Number(result).toString(16)}` : result
    },
    on(event, listener) {
      universalProvider.on(event, listener)
    },
  }
}

export async function createWalletConnectProvider(options: WalletConnectProviderOptions) {
  if (options.chainIds.length === 0) {
    throw new Error('createWalletConnectProvider() requires at least one chainId.')
  }

  const universalProvider = await UniversalProvider.init({
    projectId: options.projectId,
    metadata: options.metadata,
  })
  const { emit, on } = createEmitter<WalletConnectProviderEvents>()
  universalProvider.on('display_uri', (uri: string) => emit('uri', uri))

  async function connect(): Promise<Eip1193Provider> {
    await universalProvider.connect({
      optionalNamespaces: {
        eip155: {
          chains: options.chainIds.map((chainId) => `eip155:${chainId}`),
          methods: REQUESTED_METHODS,
          events: REQUESTED_EVENTS,
        },
      },
    })
    return toEip1193Provider(universalProvider)
  }

  function disconnect(): Promise<void> {
    return universalProvider.disconnect()
  }

  return { connect, disconnect, on }
}
