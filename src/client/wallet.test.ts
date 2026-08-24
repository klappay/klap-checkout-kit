import { describe, expect, it, vi } from 'vitest'
import type { PaymentOption } from '../types'
import { createWalletPayment, switchChain, watchAccountChanges } from './wallet'

const option: PaymentOption = {
  token: 'USDC',
  network: 'base',
  chainId: 8453,
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amountUnits: '10000000',
}

function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts') return ['0xpayer']
    if (method === 'eth_chainId') return '0x2105'
    if (method === 'wallet_switchEthereumChain') return null
    if (method === 'eth_sendTransaction') return '0xtxhash'
    throw new Error(`unexpected method ${method}`)
  })
  return { request, ...overrides }
}

describe('createWalletPayment', () => {
  it('throws when no provider is available', () => {
    expect(() => createWalletPayment(option, '0xrecipient', null)).toThrow(/no eip-1193/i)
  })

  it('throws when the option has no wallet-payable chain mapping', () => {
    const nonWalletPayable: PaymentOption = { ...option, chainId: null, contractAddress: null }
    expect(() => createWalletPayment(nonWalletPayable, '0xrecipient', makeProvider())).toThrow(
      /no wallet-payable chain mapping/i,
    )
  })

  it('reconnect() silently restores an already-authorized account without prompting', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return ['0xpayer']
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    const accounts: (string | null)[] = []
    wallet.on('account', (account) => accounts.push(account))

    const account = await wallet.reconnect()

    expect(account).toBe('0xpayer')
    expect(wallet.getAccount()).toBe('0xpayer')
    expect(accounts).toEqual(['0xpayer'])
  })

  it('reconnect() resolves null when the wallet has no authorized account yet', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return []
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)

    expect(await wallet.reconnect()).toBeNull()
  })

  it('connect() stores the first returned account and emits it', async () => {
    const provider = makeProvider()
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    const accounts: (string | null)[] = []
    wallet.on('account', (account) => accounts.push(account))

    const account = await wallet.connect()

    expect(account).toBe('0xpayer')
    expect(wallet.getAccount()).toBe('0xpayer')
    expect(accounts).toEqual(['0xpayer'])
  })

  it('pay() requires connect() first', async () => {
    const wallet = createWalletPayment(option, '0xrecipient', makeProvider())
    await expect(wallet.pay()).rejects.toThrow(/connect/i)
  })

  it('pay() switches chain only when the wallet is on a different one', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0xpayer']
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'eth_sendTransaction') return '0xtxhash'
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    await wallet.connect()

    const txHash = await wallet.pay()

    expect(txHash).toBe('0xtxhash')
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    })
  })

  it('pay() skips the chain switch when already on the target chain', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0xpayer']
        if (method === 'eth_chainId') return '0x2105'
        if (method === 'eth_sendTransaction') return '0xtxhash'
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    await wallet.connect()
    await wallet.pay()

    const calledMethods = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).not.toContain('wallet_switchEthereumChain')
  })

  it('emits error and rethrows when the wallet rejects the transaction', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0xpayer']
        if (method === 'eth_chainId') return '0x2105'
        if (method === 'eth_sendTransaction') {
          const error = Object.assign(new Error('rejected'), { code: 4001 })
          throw error
        }
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    await wallet.connect()

    const errors: unknown[] = []
    wallet.on('error', (error) => errors.push(error))

    await expect(wallet.pay()).rejects.toThrow('rejected')
    expect(errors).toHaveLength(1)
  })

  it('tracks status through a full connect() → pay() flow', async () => {
    const provider = makeProvider()
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    const statuses: string[] = []
    wallet.on('status', (status) => statuses.push(status))

    expect(wallet.getStatus()).toBe('idle')
    await wallet.connect()
    expect(wallet.getStatus()).toBe('idle')
    await wallet.pay()
    expect(wallet.getStatus()).toBe('sent')

    expect(statuses).toEqual(['connecting', 'idle', 'paying', 'sent'])
  })

  it('sets status to error and emits error when connect() itself fails', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') throw new Error('user closed the popup')
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    const errors: unknown[] = []
    wallet.on('error', (error) => errors.push(error))

    await expect(wallet.connect()).rejects.toThrow('user closed the popup')

    expect(wallet.getStatus()).toBe('error')
    expect(errors).toHaveLength(1)
  })

  it('sets status to error and emits error when the chain switch itself is rejected', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0xpayer']
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') {
          const error = Object.assign(new Error('rejected'), { code: 4001 })
          throw error
        }
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    await wallet.connect()

    const errors: unknown[] = []
    wallet.on('error', (error) => errors.push(error))

    await expect(wallet.pay()).rejects.toThrow('rejected')

    expect(wallet.getStatus()).toBe('error')
    expect(errors).toHaveLength(1)
    const calledMethods = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).not.toContain('wallet_addEthereumChain')
  })

  it('pay() adds the chain and completes when the wallet rejects the switch as unrecognized (4902)', async () => {
    let switchAttempts = 0
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') return ['0xpayer']
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') {
          switchAttempts++
          if (switchAttempts === 1) throw Object.assign(new Error('unrecognized'), { code: 4902 })
          return null
        }
        if (method === 'wallet_addEthereumChain') return null
        if (method === 'eth_sendTransaction') return '0xtxhash'
        throw new Error(`unexpected method ${method}`)
      }),
    })
    const wallet = createWalletPayment(option, '0xrecipient', provider)
    await wallet.connect()

    const errors: unknown[] = []
    wallet.on('error', (error) => errors.push(error))

    const txHash = await wallet.pay()

    expect(txHash).toBe('0xtxhash')
    expect(wallet.getStatus()).toBe('sent')
    expect(errors).toHaveLength(0)
  })
})

describe('switchChain', () => {
  function unrecognizedChainError() {
    return Object.assign(new Error('Unrecognized chain ID'), { code: 4902 })
  }

  it('does nothing when already on the target chain', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x2105'
        throw new Error(`unexpected method ${method}`)
      }),
    })

    await switchChain(provider, 8453)

    expect(provider.request).toHaveBeenCalledTimes(1)
  })

  it('switches directly when the wallet already recognizes the chain', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') return null
        throw new Error(`unexpected method ${method}`)
      }),
    })

    await switchChain(provider, 8453)

    const calledMethods = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).toEqual(['eth_chainId', 'wallet_switchEthereumChain'])
  })

  it('adds the chain and retries the switch when the wallet rejects it as unrecognized (4902)', async () => {
    let switchAttempts = 0
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') {
          switchAttempts++
          if (switchAttempts === 1) throw unrecognizedChainError()
          return null
        }
        if (method === 'wallet_addEthereumChain') return null
        throw new Error(`unexpected method ${method}`)
      }),
    })

    await switchChain(provider, 8453)

    const calls = (provider.request as ReturnType<typeof vi.fn>).mock.calls
    const calledMethods = calls.map((call) => (call[0] as { method: string }).method)
    expect(calledMethods).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'wallet_switchEthereumChain',
    ])
    expect(calls[2]?.[0]).toEqual({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0x2105',
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        },
      ],
    })
  })

  it('propagates the original error, without adding a chain, when the wallet rejects the switch for any other reason', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') {
          throw Object.assign(new Error('user rejected'), { code: 4001 })
        }
        throw new Error(`unexpected method ${method}`)
      }),
    })

    await expect(switchChain(provider, 8453)).rejects.toThrow('user rejected')

    const calledMethods = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).not.toContain('wallet_addEthereumChain')
  })

  it('propagates the original 4902 error, without adding a chain, when the target chainId has no known mapping', async () => {
    const provider = makeProvider({
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1'
        if (method === 'wallet_switchEthereumChain') throw unrecognizedChainError()
        throw new Error(`unexpected method ${method}`)
      }),
    })

    await expect(switchChain(provider, 999999)).rejects.toThrow('Unrecognized chain ID')

    const calledMethods = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { method: string }).method,
    )
    expect(calledMethods).not.toContain('wallet_addEthereumChain')
  })
})

describe('watchAccountChanges', () => {
  it('calls onChange with the first account when the wallet reports a change', () => {
    let listener: ((accounts: unknown) => void) | undefined
    const provider = {
      request: vi.fn(),
      on: vi.fn((event: string, l: (...args: unknown[]) => void) => {
        if (event === 'accountsChanged') listener = l
      }),
    }

    const seen: (string | null)[] = []
    watchAccountChanges(provider, (account) => seen.push(account))
    listener?.(['0xnew', '0xother'])

    expect(seen).toEqual(['0xnew'])
  })

  it('calls onChange with null when the wallet reports no accounts (disconnected)', () => {
    let listener: ((accounts: unknown) => void) | undefined
    const provider = {
      request: vi.fn(),
      on: vi.fn((event: string, l: (...args: unknown[]) => void) => {
        if (event === 'accountsChanged') listener = l
      }),
    }

    const seen: (string | null)[] = []
    watchAccountChanges(provider, (account) => seen.push(account))
    listener?.([])

    expect(seen).toEqual([null])
  })

  it('does nothing when the provider has no on() method', () => {
    const provider = { request: vi.fn() }
    expect(() => watchAccountChanges(provider, () => {})).not.toThrow()
  })
})
