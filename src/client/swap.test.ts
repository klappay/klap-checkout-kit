import { describe, expect, it, vi } from 'vitest'
import type { SwapQuote } from '../types'
import { createSwapPayment } from './swap'

const nativeQuote: SwapQuote = {
  inputToken: 'ETH',
  inputNetwork: 'base',
  inputAmount: 0.005,
  outputToken: 'USDC',
  outputNetwork: 'base',
  outputAmount: 10,
  fees: { klappayFee: 0.1, zeroExFee: null },
  expiresAt: '2026-01-01T00:00:30.000Z',
  transaction: {
    to: '0xsettler000000000000000000000000000000000',
    data: '0xdeadbeef',
    value: '5000000000000000',
  },
}

const permit2Quote: SwapQuote = {
  inputToken: 'BTC',
  inputNetwork: 'base',
  inputAmount: 0.0002,
  outputToken: 'USDC',
  outputNetwork: 'base',
  outputAmount: 10,
  fees: { klappayFee: 0.1, zeroExFee: null },
  expiresAt: '2026-01-01T00:00:30.000Z',
  transaction: { to: '0xsettler000000000000000000000000000000000', data: '0xdeadbeef', value: '0' },
  permit2: {
    eip712: {
      domain: { name: 'Permit2', chainId: 8453 },
      types: { PermitTransferFrom: [] },
      primaryType: 'PermitTransferFrom',
      message: {},
    },
  },
}

type MockRequest = ({ method, params }: { method: string; params?: unknown[] }) => Promise<unknown>

function sendTransactionMock(): (params?: unknown[]) => string {
  return (params) => {
    const data = (params?.[0] as { data: string }).data
    return data.startsWith('0x095ea7b3') ? '0xapprovehash' : '0xswaphash'
  }
}

function makeProvider(request: MockRequest) {
  return { request: vi.fn(request) }
}

function sufficientAllowanceRequest(): MockRequest {
  const sendTx = sendTransactionMock()
  return async ({ method, params }) => {
    if (method === 'eth_requestAccounts') return ['0xpayer']
    if (method === 'eth_accounts') return ['0xpayer']
    if (method === 'eth_chainId') return '0x2105'
    if (method === 'wallet_switchEthereumChain') return null
    if (method === 'eth_call') return `0x${'f'.repeat(64)}`
    if (method === 'eth_getTransactionReceipt') return { status: '0x1' }
    if (method === 'eth_signTypedData_v4') return `0x${'ab'.repeat(65)}`
    if (method === 'eth_sendTransaction') return sendTx(params)
    throw new Error(`unexpected method ${method}`)
  }
}

function insufficientAllowanceRequest(receiptStatus: '0x1' | '0x0' = '0x1'): MockRequest {
  const sendTx = sendTransactionMock()
  return async ({ method, params }) => {
    if (method === 'eth_requestAccounts') return ['0xpayer']
    if (method === 'eth_chainId') return '0x2105'
    if (method === 'eth_call') return '0x0'
    if (method === 'eth_getTransactionReceipt') return { status: receiptStatus }
    if (method === 'eth_signTypedData_v4') return `0x${'ab'.repeat(65)}`
    if (method === 'eth_sendTransaction') return sendTx(params)
    throw new Error(`unexpected method ${method}`)
  }
}

function methodsCalled(provider: { request: ReturnType<typeof vi.fn> }): string[] {
  return provider.request.mock.calls.map((call) => (call[0] as { method: string }).method)
}

function sentDataOf(call: unknown[]): string {
  const params = (call[0] as { params?: unknown[] }).params
  return (params?.[0] as { data: string }).data
}

describe('createSwapPayment', () => {
  it('throws when no provider is available', () => {
    expect(() => createSwapPayment(nativeQuote, null)).toThrow(/no eip-1193/i)
  })

  it('reconnect() silently restores an already-authorized account without prompting', async () => {
    const provider = makeProvider(sufficientAllowanceRequest())
    const swap = createSwapPayment(nativeQuote, provider)
    const accounts: (string | null)[] = []
    swap.on('account', (account) => accounts.push(account))

    const account = await swap.reconnect()

    expect(account).toBe('0xpayer')
    expect(swap.getAccount()).toBe('0xpayer')
    expect(accounts).toEqual(['0xpayer'])
  })

  it('pay() requires connect() first', async () => {
    const provider = makeProvider(sufficientAllowanceRequest())
    const swap = createSwapPayment(nativeQuote, provider)
    await expect(swap.pay()).rejects.toThrow(/connect/i)
  })

  it('pay() sends the transaction as-is with a hex value when the input is native, with no allowance/approve calls', async () => {
    const provider = makeProvider(sufficientAllowanceRequest())
    const swap = createSwapPayment(nativeQuote, provider)
    await swap.connect()

    const txHash = await swap.pay()

    expect(txHash).toBe('0xswaphash')
    expect(methodsCalled(provider)).not.toContain('eth_call')
    expect(methodsCalled(provider)).not.toContain('eth_signTypedData_v4')
    expect(provider.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [
        {
          from: '0xpayer',
          to: nativeQuote.transaction.to,
          data: nativeQuote.transaction.data,
          value: '0x11c37937e08000',
        },
      ],
    })
  })

  it('pay() skips approval and signs+appends the permit2 signature when allowance is already sufficient', async () => {
    const provider = makeProvider(sufficientAllowanceRequest())
    const swap = createSwapPayment(permit2Quote, provider)
    await swap.connect()

    const txHash = await swap.pay()

    expect(txHash).toBe('0xswaphash')
    expect(methodsCalled(provider)).toContain('eth_call')
    expect(methodsCalled(provider)).not.toContain('eth_getTransactionReceipt')
    expect(methodsCalled(provider)).toContain('eth_signTypedData_v4')

    const swapCall = provider.request.mock.calls.find(
      (call) => (call[0] as { method: string }).method === 'eth_sendTransaction',
    )
    const sentData = sentDataOf(swapCall as unknown[])
    expect(sentData.startsWith(permit2Quote.transaction.data)).toBe(true)
    expect(sentData.length).toBe(permit2Quote.transaction.data.length + 64 + 130)
  })

  it('pay() approves Permit2 and waits for the receipt when allowance is insufficient', async () => {
    const provider = makeProvider(insufficientAllowanceRequest())
    const swap = createSwapPayment(permit2Quote, provider)
    await swap.connect()

    const approvals: string[] = []
    swap.on('approved', (hash) => approvals.push(hash))

    const txHash = await swap.pay()

    expect(txHash).toBe('0xswaphash')
    expect(approvals).toEqual(['0xapprovehash'])
    expect(methodsCalled(provider)).toContain('eth_getTransactionReceipt')
    const approveCall = provider.request.mock.calls.find(
      (call) =>
        (call[0] as { method: string }).method === 'eth_sendTransaction' &&
        sentDataOf(call).startsWith('0x095ea7b3'),
    )
    expect(approveCall).toBeDefined()
  })

  it('tracks status through a full permit2 connect() → pay() flow', async () => {
    const provider = makeProvider(insufficientAllowanceRequest())
    const swap = createSwapPayment(permit2Quote, provider)
    const statuses: string[] = []
    swap.on('status', (status) => statuses.push(status))

    await swap.connect()
    await swap.pay()

    expect(statuses).toEqual([
      'connecting',
      'idle',
      'checking-allowance',
      'approving',
      'signing',
      'paying',
      'sent',
    ])
  })

  it('tracks status through a native connect() → pay() flow, skipping the permit2 states', async () => {
    const provider = makeProvider(sufficientAllowanceRequest())
    const swap = createSwapPayment(nativeQuote, provider)
    const statuses: string[] = []
    swap.on('status', (status) => statuses.push(status))

    await swap.connect()
    await swap.pay()

    expect(statuses).toEqual(['connecting', 'idle', 'paying', 'sent'])
  })

  it('emits error and rethrows when the wallet rejects the permit2 signature', async () => {
    const provider = makeProvider(async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0xpayer']
      if (method === 'eth_chainId') return '0x2105'
      if (method === 'eth_call') return `0x${'f'.repeat(64)}`
      if (method === 'eth_signTypedData_v4') {
        throw Object.assign(new Error('rejected'), { code: 4001 })
      }
      throw new Error(`unexpected method ${method}`)
    })
    const swap = createSwapPayment(permit2Quote, provider)
    await swap.connect()

    const errors: unknown[] = []
    swap.on('error', (error) => errors.push(error))

    await expect(swap.pay()).rejects.toThrow('rejected')
    expect(swap.getStatus()).toBe('error')
    expect(errors).toHaveLength(1)
  })

  it('throws a clear error when the approval transaction reverts', async () => {
    const provider = makeProvider(insufficientAllowanceRequest('0x0'))
    const swap = createSwapPayment(permit2Quote, provider)
    await swap.connect()

    await expect(swap.pay()).rejects.toThrow(/reverted/i)
  })

  it('switches chain only when the wallet is on a different one', async () => {
    const provider = makeProvider(async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0xpayer']
      if (method === 'eth_chainId') return '0x1'
      if (method === 'wallet_switchEthereumChain') return null
      if (method === 'eth_sendTransaction') return '0xswaphash'
      throw new Error(`unexpected method ${method}`)
    })
    const swap = createSwapPayment(nativeQuote, provider)
    await swap.connect()

    await swap.pay()

    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    })
  })
})
