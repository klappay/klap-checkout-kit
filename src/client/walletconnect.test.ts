import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentOption } from '../types'
import { createWalletPayment } from './wallet'

type MockSession = { expiry: number; namespaces: { eip155?: { accounts: string[] } } }

const { mockProvider, initMock } = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  const noSession = (): MockSession | undefined => undefined
  const mockProvider = {
    session: noSession(),
    client: {
      core: {
        relayer: {
          connected: true,
          restartTransport: vi.fn(async () => {
            mockProvider.client.core.relayer.connected = true
          }),
        },
      },
    },
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return 8453
      if (method === 'eth_requestAccounts') return ['0xpayer']
      if (method === 'eth_accounts') return ['0xpayer']
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

const option: PaymentOption = {
  token: 'USDC',
  network: 'base',
  chainId: 8453,
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amountUnits: '10000000',
}

function sessionWith(accounts: string[], expiresInSeconds = 3600): MockSession {
  return {
    expiry: Math.floor(Date.now() / 1000) + expiresInSeconds,
    namespaces: { eip155: { accounts } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProvider.session = undefined
  mockProvider.client.core.relayer.connected = true
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = await wc.connect()
    const wallet = createWalletPayment(option, '0xrecipient', provider)

    const account = await wallet.connect()
    const txHash = await wallet.pay()

    expect(account).toBe('0xpayer')
    expect(txHash).toBe('0xtxhash')
    expect(wallet.getStatus()).toBe('sent')
    const calledMethods = mockProvider.request.mock.calls.map((call) => call[0].method)
    expect(calledMethods).not.toContain('wallet_switchEthereumChain')
  })
})

describe('createWalletConnectProvider().restore()', () => {
  it('returns null when UniversalProvider restored no session', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    expect(wc.restore()).toBeNull()
  })

  it('returns a provider for a persisted, unexpired session without pairing again', async () => {
    mockProvider.session = sessionWith(['eip155:8453:0xpayer'])
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const uris: string[] = []
    wc.on('uri', (uri) => uris.push(uri))

    const provider = wc.restore()

    expect(provider).not.toBeNull()
    expect(await provider?.request({ method: 'eth_chainId' })).toBe('0x2105')
    expect(mockProvider.connect).not.toHaveBeenCalled()
    expect(uris).toEqual([])
  })

  it('returns null once the persisted session has expired', async () => {
    mockProvider.session = sessionWith(['eip155:8453:0xpayer'], -1)
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    expect(wc.restore()).toBeNull()
  })

  it('treats a session expiring exactly now as expired', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    mockProvider.session = {
      expiry: 1_700_000_000,
      namespaces: { eip155: { accounts: ['eip155:8453:0xpayer'] } },
    }
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    expect(wc.restore()).toBeNull()
    vi.useRealTimers()
  })

  it('returns null for a session with no eip155 accounts', async () => {
    mockProvider.session = { expiry: Math.floor(Date.now() / 1000) + 3600, namespaces: {} }
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    expect(wc.restore()).toBeNull()
  })

  it('restore(chainId) requires an approved account on that exact chain', async () => {
    mockProvider.session = sessionWith(['eip155:10:0xpayer', 'eip155:84532:0xpayer'])
    const wc = await createWalletConnectProvider({
      projectId: 'p',
      chainIds: [8453, 10, 84532],
      metadata,
    })

    expect(wc.restore(8453)).toBeNull()
    expect(wc.restore(845)).toBeNull()
    expect(wc.restore(10)).not.toBeNull()
    expect(wc.restore(84532)).not.toBeNull()
  })

  it('the restored provider resumes a createWalletPayment() through reconnect() with no wallet prompt', async () => {
    mockProvider.session = sessionWith(['eip155:8453:0xpayer'])
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const provider = wc.restore(8453)
    if (!provider) throw new Error('expected a restored provider')
    const wallet = createWalletPayment(option, '0xrecipient', provider)

    const account = await wallet.reconnect()
    const txHash = await wallet.pay()

    expect(account).toBe('0xpayer')
    expect(txHash).toBe('0xtxhash')
    const calledMethods = mockProvider.request.mock.calls.map((call) => call[0].method)
    expect(calledMethods).not.toContain('eth_requestAccounts')
  })
})

describe('createWalletConnectProvider() disconnect event', () => {
  it('emits "disconnect" when the wallet ends the session', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    let disconnects = 0
    wc.on('disconnect', () => disconnects++)

    mockProvider.emit('disconnect', { code: 6000, message: 'User disconnected.' })

    expect(disconnects).toBe(1)
  })
})

describe('createWalletConnectProvider().watchReconnect()', () => {
  it('restarts the UniversalProvider relayer when the page becomes visible again', async () => {
    const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', fakeDocument)
    mockProvider.client.core.relayer.connected = false
    mockProvider.session = sessionWith(['eip155:8453:0xpayer'])
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const states: string[] = []

    const stop = wc.watchReconnect((state) => states.push(state))
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(states).toEqual(['started', 'recovered']))
    stop()

    expect(mockProvider.client.core.relayer.restartTransport).toHaveBeenCalledTimes(1)
  })

  it('stays idle before any session exists, so an unpaired page never reports failures', async () => {
    const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('document', fakeDocument)
    mockProvider.client.core.relayer.connected = false
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })
    const states: string[] = []

    const stop = wc.watchReconnect((state) => states.push(state))
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    stop()

    expect(states).toEqual([])
    expect(mockProvider.client.core.relayer.restartTransport).not.toHaveBeenCalled()
  })

  it('is a no-op outside a browser (no document, e.g. during SSR)', async () => {
    const wc = await createWalletConnectProvider({ projectId: 'p', chainIds: [8453], metadata })

    const stop = wc.watchReconnect(() => {})

    expect(typeof stop).toBe('function')
    expect(() => stop()).not.toThrow()
  })
})
