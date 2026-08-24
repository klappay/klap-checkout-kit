import type { Eip1193Provider } from './wallet'

export type Eip6963ProviderInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo
  provider: Eip1193Provider
}

export function discoverProviders(): Promise<Eip6963ProviderDetail[]> {
  return new Promise((resolve) => {
    const seen = new Map<string, Eip6963ProviderDetail>()

    function onAnnounce(event: Event): void {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail
      seen.set(detail.info.uuid, detail)
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      resolve([...seen.values()])
    }, 0)
  })
}
