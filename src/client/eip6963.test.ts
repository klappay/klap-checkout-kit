// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { discoverProviders } from './eip6963'
import type { Eip6963ProviderDetail } from './eip6963'

function announceOnRequest(detail: Eip6963ProviderDetail): () => void {
  const listener = () => {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }))
  }
  window.addEventListener('eip6963:requestProvider', listener)
  return () => window.removeEventListener('eip6963:requestProvider', listener)
}

function makeDetail(uuid: string, name: string): Eip6963ProviderDetail {
  return {
    info: { uuid, name, icon: `data:image/png;base64,${uuid}`, rdns: `com.example.${name}` },
    provider: { request: vi.fn() },
  }
}

describe('discoverProviders', () => {
  it('resolves to an empty array when no wallet announces', async () => {
    expect(await discoverProviders()).toEqual([])
  })

  it('resolves with a wallet that responds to the request', async () => {
    const detail = makeDetail('uuid-1', 'MetaMask')
    const stop = announceOnRequest(detail)

    const providers = await discoverProviders()

    expect(providers).toEqual([detail])
    stop()
  })

  it('collects multiple wallets that respond to the same request', async () => {
    const metamask = makeDetail('uuid-1', 'MetaMask')
    const coinbase = makeDetail('uuid-2', 'Coinbase Wallet')
    const stopA = announceOnRequest(metamask)
    const stopB = announceOnRequest(coinbase)

    const providers = await discoverProviders()

    expect(providers).toHaveLength(2)
    expect(providers).toEqual(expect.arrayContaining([metamask, coinbase]))
    stopA()
    stopB()
  })

  it('dedupes repeated announcements from the same uuid, keeping the latest', async () => {
    const first = makeDetail('uuid-1', 'MetaMask')
    const second = { ...first, info: { ...first.info, name: 'MetaMask (updated)' } }
    const listener = () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: first }))
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: second }))
    }
    window.addEventListener('eip6963:requestProvider', listener)

    const providers = await discoverProviders()

    expect(providers).toEqual([second])
    window.removeEventListener('eip6963:requestProvider', listener)
  })

  it('returns the exact provider object from the event detail, unmodified', async () => {
    const detail = makeDetail('uuid-1', 'MetaMask')
    const stop = announceOnRequest(detail)

    const [result] = await discoverProviders()

    expect(result?.provider).toBe(detail.provider)
    stop()
  })
})
