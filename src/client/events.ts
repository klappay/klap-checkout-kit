import type { CheckoutPayload } from '../types'

export function watchCheckoutEvents(
  url: string,
  onUpdate: (payload: CheckoutPayload) => void,
  eventName = 'charge',
): () => void {
  const source = new EventSource(url)
  source.addEventListener(eventName, (event) => {
    onUpdate(JSON.parse((event as MessageEvent<string>).data))
  })
  return () => source.close()
}
