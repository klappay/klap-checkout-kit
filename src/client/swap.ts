import type { SwapQuote } from '../types'
import { createEmitter } from './emitter'
import {
  ALT_TOKEN_ADDRESSES,
  ALT_TOKEN_DECIMALS,
  CHAIN_IDS,
  MAX_UINT256,
  PERMIT2_ADDRESS,
  appendPermit2Signature,
  encodeErc20Allowance,
  encodeErc20Approve,
  toBaseUnits,
} from './permit2'
import {
  type Eip1193Provider,
  getInjectedProvider,
  providerRequest,
  watchAccountChanges,
} from './wallet'

const APPROVAL_POLL_INTERVAL_MS = 2_000
const APPROVAL_POLL_MAX_ATTEMPTS = 60

export type SwapPaymentStatus =
  | 'idle'
  | 'connecting'
  | 'checking-allowance'
  | 'approving'
  | 'signing'
  | 'paying'
  | 'sent'
  | 'error'

export type SwapPaymentEvents = {
  account: (account: string | null) => void
  status: (status: SwapPaymentStatus) => void
  approved: (txHash: string) => void
  sent: (txHash: string) => void
  error: (error: unknown) => void
}

type TransactionReceipt = { status: string } | null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForReceipt(provider: Eip1193Provider, txHash: string): Promise<void> {
  for (let attempt = 0; attempt < APPROVAL_POLL_MAX_ATTEMPTS; attempt++) {
    const receipt = await providerRequest<TransactionReceipt>(
      provider,
      'eth_getTransactionReceipt',
      [txHash],
    )
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('Permit2 approval transaction reverted.')
      return
    }
    await delay(APPROVAL_POLL_INTERVAL_MS)
  }
  throw new Error('Timed out waiting for the Permit2 approval transaction to confirm.')
}

export function createSwapPayment(
  quote: SwapQuote,
  injectedProvider: Eip1193Provider | null = getInjectedProvider(),
) {
  if (!injectedProvider) {
    throw new Error('No EIP-1193 wallet provider found — is a browser wallet extension installed?')
  }
  const liveChainId = CHAIN_IDS[quote.inputNetwork]?.live
  if (!liveChainId) {
    throw new Error(`No chain mapping for ${quote.inputNetwork}.`)
  }
  const chainId = liveChainId
  const provider = injectedProvider

  let account: string | null = null
  let status: SwapPaymentStatus = 'idle'
  const { emit, on } = createEmitter<SwapPaymentEvents>()

  function setStatus(next: SwapPaymentStatus): void {
    status = next
    emit('status', next)
  }

  watchAccountChanges(provider, (next) => {
    account = next
    emit('account', account)
  })

  async function connect(): Promise<string> {
    setStatus('connecting')
    try {
      const accounts = await providerRequest<string[]>(provider, 'eth_requestAccounts')
      account = accounts[0] ?? null
      emit('account', account)
      if (!account) throw new Error('Wallet returned no account.')
      setStatus('idle')
      return account
    } catch (error) {
      setStatus('error')
      emit('error', error)
      throw error
    }
  }

  async function reconnect(): Promise<string | null> {
    const accounts = await providerRequest<string[]>(provider, 'eth_accounts')
    account = accounts[0] ?? null
    emit('account', account)
    return account
  }

  async function ensureAllowance(owner: string): Promise<void> {
    if (!quote.permit2) return
    const tokenAddress = ALT_TOKEN_ADDRESSES[quote.inputNetwork]?.[quote.inputToken]
    if (!tokenAddress || tokenAddress === 'native') {
      throw new Error(`No ERC-20 address mapping for ${quote.inputToken} on ${quote.inputNetwork}.`)
    }

    setStatus('checking-allowance')
    const rawAllowance = await providerRequest<string>(provider, 'eth_call', [
      { to: tokenAddress, data: encodeErc20Allowance(owner, PERMIT2_ADDRESS) },
      'latest',
    ])
    const currentAllowance = BigInt(rawAllowance)
    const requiredAmount = toBaseUnits(quote.inputAmount, ALT_TOKEN_DECIMALS[quote.inputToken])
    if (currentAllowance >= requiredAmount) return

    setStatus('approving')
    const approveTxHash = await providerRequest<string>(provider, 'eth_sendTransaction', [
      { from: owner, to: tokenAddress, data: encodeErc20Approve(PERMIT2_ADDRESS, MAX_UINT256) },
    ])
    await waitForReceipt(provider, approveTxHash)
    emit('approved', approveTxHash)
  }

  async function pay(): Promise<string> {
    if (!account) throw new Error('Call connect() before pay().')
    const payer = account

    try {
      const targetChainIdHex = `0x${chainId.toString(16)}`
      const currentChainIdHex = await providerRequest<string>(provider, 'eth_chainId')
      if (currentChainIdHex.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        await providerRequest(provider, 'wallet_switchEthereumChain', [
          { chainId: targetChainIdHex },
        ])
      }

      await ensureAllowance(payer)

      let data = quote.transaction.data
      if (quote.permit2) {
        setStatus('signing')
        const signature = await providerRequest<`0x${string}`>(provider, 'eth_signTypedData_v4', [
          payer,
          JSON.stringify(quote.permit2.eip712),
        ])
        data = appendPermit2Signature(data, signature)
      }

      setStatus('paying')
      const txHash = await providerRequest<string>(provider, 'eth_sendTransaction', [
        {
          from: payer,
          to: quote.transaction.to,
          data,
          ...(quote.transaction.value !== '0'
            ? { value: `0x${BigInt(quote.transaction.value).toString(16)}` }
            : {}),
        },
      ])
      setStatus('sent')
      emit('sent', txHash)
      return txHash
    } catch (error) {
      setStatus('error')
      emit('error', error)
      throw error
    }
  }

  return {
    connect,
    reconnect,
    pay,
    on,
    getAccount: (): string | null => account,
    getStatus: (): SwapPaymentStatus => status,
  }
}
