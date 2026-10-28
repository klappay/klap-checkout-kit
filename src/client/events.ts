import type { CheckoutEvent, CheckoutPayload } from '../types'

function readData(event: Event): string | null {
  return 'data' in event && typeof event.data === 'string' ? event.data : null
}

export function watchCheckoutEvents(
  url: string,
  onUpdate: (payload: CheckoutPayload) => void,
  eventName = 'charge',
): () => void {
  const source = new EventSource(url)
  source.addEventListener(eventName, (event) => {
    const data = readData(event)
    if (data !== null) onUpdate(JSON.parse(data))
  })
  return () => source.close()
}

export function watchCheckoutEventsWithProgress(
  url: string,
  onEvent: (event: CheckoutEvent) => void,
): () => void {
  const source = new EventSource(url)
  source.addEventListener('charge', (event) => {
    const data = readData(event)
    if (data !== null) onEvent({ type: 'charge', payload: JSON.parse(data).payload })
  })
  source.addEventListener('confirmation_progress', (event) => {
    const data = readData(event)
    if (data !== null) {
      onEvent({ type: 'confirmation_progress', progress: JSON.parse(data).progress })
    }
  })
  return () => source.close()
}
