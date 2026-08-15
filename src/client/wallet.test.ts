import { describe, expect, it, vi } from 'vitest'
import type { PaymentOption } from '../types'
import { createWalletPayment } from './wallet'

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
  })
})
