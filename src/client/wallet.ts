import { encodeErc20Transfer } from '../payment-uri'
import type { PaymentOption } from '../types'
import { createEmitter } from './emitter'

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
}

export function providerRequest<T>(
  provider: Eip1193Provider,
  method: string,
  params?: unknown[],
): Promise<T> {
  return provider.request({ method, params }) as Promise<T>
}

export function watchAccountChanges(
  provider: Eip1193Provider,
  onChange: (account: string | null) => void,
): void {
  if (typeof provider.on !== 'function') return
  provider.on('accountsChanged', (accounts) => {
    onChange(Array.isArray(accounts) ? ((accounts[0] as string | undefined) ?? null) : null)
  })
}

export type WalletStatus = 'idle' | 'connecting' | 'paying' | 'sent' | 'error'

export type WalletPaymentEvents = {
  account: (account: string | null) => void
  status: (status: WalletStatus) => void
  sent: (txHash: string) => void
  error: (error: unknown) => void
}

export function getInjectedProvider(): Eip1193Provider | null {
  const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum
  return provider ?? null
}

export function createWalletPayment(
  option: PaymentOption,
  recipientAddress: string,
  injectedProvider: Eip1193Provider | null = getInjectedProvider(),
) {
  if (!injectedProvider) {
    throw new Error('No EIP-1193 wallet provider found — is a browser wallet extension installed?')
  }
  if (option.chainId === null || option.contractAddress === null) {
    throw new Error(
      `No wallet-payable chain mapping for ${option.token} on ${option.network} — use buildPaymentUri() for QR/address payment instead.`,
    )
  }
  const provider = injectedProvider
  const chainId = option.chainId
  const contractAddress = option.contractAddress

  let account: string | null = null
  let status: WalletStatus = 'idle'
  const { emit, on } = createEmitter<WalletPaymentEvents>()

  function setStatus(next: WalletStatus): void {
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

  async function pay(): Promise<string> {
    if (!account) throw new Error('Call connect() before pay().')
    setStatus('paying')

    try {
      const targetChainIdHex = `0x${chainId.toString(16)}`
      const currentChainIdHex = await providerRequest<string>(provider, 'eth_chainId')
      if (currentChainIdHex.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        await providerRequest(provider, 'wallet_switchEthereumChain', [
          { chainId: targetChainIdHex },
        ])
      }

      const txHash = await providerRequest<string>(provider, 'eth_sendTransaction', [
        {
          from: account,
          to: contractAddress,
          data: encodeErc20Transfer(recipientAddress, option.amountUnits),
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
    getStatus: (): WalletStatus => status,
  }
}
