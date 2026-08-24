import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentOption } from '../types'
import { createWalletPayment } from './wallet'

const { mockProvider, initMock } = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  const mockProvider = {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return 8453
      if (method === 'eth_requestAccounts') return ['0xpayer']
      if (method === 'eth_sendTransaction') return '0xtxhash'
      throw new Error(`unexpected method ${method}`)
    }),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener)
    }),
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.(...args)
    },
  }
  const initMock = vi.fn(async () => mockProvider)
  return { mockProvider, initMock }
})

vi.mock('@walletconnect/universal-provider', () => ({
  UniversalProvider: { init: initMock },
}))

const { createWalletConnectProvider } = await import('./walletconnect')

const metadata = {
  name: 'Test Checkout',
  description: 'Test',
  url: 'https://example.com',
  icons: ['https://example.com/icon.png'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createWalletConnectProvider', () => {
  it('throws when no chainIds are given', async () => {
    await expect(
      createWalletConnectProvider({ projectId: 'p', chainIds: [], metadata }),
    ).rejects.toThrow(/at least one chainId/i)
  })

  it('initializes UniversalProvider with the given projectId/metadata', async () => {
    await createWalletConnectProvider({ projectId: 'test-project-id', chainIds: [8453], metadata })

    expect(initMock).toHaveBeenCalledWith({ projectId: 'test-project-id', metadata })
  })

  it('emits "uri" when the underlying provider fires display_uri', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const uris: string[] = []
    wc.on('uri', (uri) => uris.push(uri))

    mockProvider.emit('display_uri', 'wc:abc123@2')

    expect(uris).toEqual(['wc:abc123@2'])
  })

  it('connect() requests the eip155 namespace for every given chainId with a minimal method set', async () => {
    const wc = await createWalletConnectProvider({
      projectId: 'p',
      chainIds: [8453, 84532],
      metadata,
    })

    await wc.connect()

    expect(mockProvider.connect).toHaveBeenCalledWith({
      optionalNamespaces: {
        eip155: {
          chains: ['eip155:8453', 'eip155:84532'],
          methods: ['eth_sendTransaction', 'eth_signTypedData_v4'],
          events: ['chainChanged', 'accountsChanged'],
        },
      },
    })
  })

  it('connect() resolves to an Eip1193Provider that normalizes eth_chainId to a hex string', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = await wc.connect()

    const chainId = await provider.request({ method: 'eth_chainId' })

    expect(chainId).toBe('0x2105')
  })

  it('connect() resolves to a provider that passes other methods through unchanged', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = await wc.connect()

    const accounts = await provider.request({ method: 'eth_requestAccounts' })

    expect(accounts).toEqual(['0xpayer'])
  })

  it('the resolved provider forwards on() to the underlying UniversalProvider', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = await wc.connect()

    const accounts: unknown[] = []
    provider.on?.('accountsChanged', (...args) => accounts.push(args[0]))
    mockProvider.emit('accountsChanged', ['0xnew'])

    expect(accounts).toEqual([['0xnew']])
  })

  it('disconnect() delegates to the underlying UniversalProvider', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    await wc.disconnect()

    expect(mockProvider.disconnect).toHaveBeenCalledTimes(1)
  })

  it('the resolved provider plugs directly into createWalletPayment()', async () => {
    const option: PaymentOption = {
      token: 'USDC',
      network: 'base',
      chainId: 8453,
      contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amountUnits: '10000000',
    }
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = await wc.connect()
    const wallet = createWalletPayment(option, '0xrecipient', provider)

    const account = await wallet.connect()
    const txHash = await wallet.pay()

    expect(account).toBe('0xpayer')
    expect(txHash).toBe('0xtxhash')
    expect(wallet.getStatus()).toBe('sent')
    const calledMethods = mockProvider.request.mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).not.toContain('wallet_switchEthereumChain')
  })
})
