import { encodeErc20Transfer } from '../payment-uri'
import type { PaymentOption } from '../types'

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
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
  const listeners = new Map<keyof WalletPaymentEvents, Set<(...args: never[]) => void>>()

  function emit<K extends keyof WalletPaymentEvents>(
    event: K,
    ...args: Parameters<WalletPaymentEvents[K]>
  ): void {
    for (const listener of listeners.get(event) ?? [])
      (listener as (...a: unknown[]) => void)(...args)
  }

  function on<K extends keyof WalletPaymentEvents>(
    event: K,
    listener: WalletPaymentEvents[K],
  ): () => void {
    const set = listeners.get(event) ?? new Set()
    set.add(listener as (...args: never[]) => void)
    listeners.set(event, set)
    return () => set.delete(listener as (...args: never[]) => void)
  }

  function setStatus(next: WalletStatus): void {
    status = next
    emit('status', next)
  }

  if (typeof provider.on === 'function') {
    provider.on('accountsChanged', (accounts) => {
      account = Array.isArray(accounts) ? ((accounts[0] as string | undefined) ?? null) : null
      emit('account', account)
    })
  }

  async function connect(): Promise<string> {
    setStatus('connecting')
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
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
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
    account = accounts[0] ?? null
    emit('account', account)
    return account
  }

  async function pay(): Promise<string> {
    if (!account) throw new Error('Call connect() before pay().')
    setStatus('paying')

    try {
      const targetChainIdHex = `0x${chainId.toString(16)}`
      const currentChainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
      if (currentChainIdHex.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        })
      }

      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            data: encodeErc20Transfer(recipientAddress, option.amountUnits),
          },
        ],
      })) as string
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
