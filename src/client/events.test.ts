import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutEvent, CheckoutPayload } from '../types'
import { watchCheckoutEvents, watchCheckoutEventsWithProgress } from './events'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly listeners = new Map<string, ((event: Event) => void)[]>()
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
  }

  close() {
    this.closed = true
  }

  dispatch(name: string, event: Event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event)
  }
}

function lastSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1)
  if (!source) throw new Error('no EventSource was created')
  return source
}

function message(data: unknown): MessageEvent<string> {
  return new MessageEvent('message', { data: JSON.stringify(data) })
}

function polyfillEvent(data: unknown): Event {
  return Object.assign(new Event('message'), { data: JSON.stringify(data) })
}

const payload = { id: 'ch_1', status: 'pending' } as const satisfies Partial<CheckoutPayload>
const progress = { network: 'base', blocksSeen: 2, blocksRequired: 6, percent: 33 }

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('watchCheckoutEvents', () => {
  it('opens one EventSource on the given url and forwards each "charge" payload', () => {
    const updates: unknown[] = []
    watchCheckoutEvents('/api/checkout/ch_1/events', (update) => updates.push(update))

    lastSource().dispatch('charge', message(payload))

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(lastSource().url).toBe('/api/checkout/ch_1/events')
    expect(updates).toEqual([payload])
  })

  it('listens on a custom event name when given one', () => {
    const updates: unknown[] = []
    watchCheckoutEvents('/events', (update) => updates.push(update), 'update')

    lastSource().dispatch('charge', message({ id: 'ignored' }))
    lastSource().dispatch('update', message(payload))

    expect(updates).toEqual([payload])
  })

  it('accepts events from an EventSource polyfill that are not MessageEvent instances', () => {
    const updates: unknown[] = []
    watchCheckoutEvents('/events', (update) => updates.push(update))

    lastSource().dispatch('charge', polyfillEvent(payload))

    expect(updates).toEqual([payload])
  })

  it('ignores an event without string data', () => {
    const updates: unknown[] = []
    watchCheckoutEvents('/events', (update) => updates.push(update))

    lastSource().dispatch('charge', new Event('charge'))

    expect(updates).toEqual([])
  })

  it('stop() closes the EventSource', () => {
    const stop = watchCheckoutEvents('/events', () => {})

    stop()

    expect(lastSource().closed).toBe(true)
  })
})

describe('watchCheckoutEventsWithProgress', () => {
  it('unwraps the documented { type, payload } shape of a "charge" event', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch('charge', message({ type: 'charge', payload }))

    expect(events).toEqual([{ type: 'charge', payload }])
  })

  it('unwraps the documented { type, progress } shape of a "confirmation_progress" event', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch(
      'confirmation_progress',
      message({ type: 'confirmation_progress', progress }),
    )

    expect(events).toEqual([{ type: 'confirmation_progress', progress }])
  })

  it('takes the event type from the SSE event name, not from the data body', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch('confirmation_progress', message({ type: 'charge', progress }))

    expect(events).toEqual([{ type: 'confirmation_progress', progress }])
  })

  it('delivers both event kinds over a single EventSource, in arrival order', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch(
      'confirmation_progress',
      message({ type: 'confirmation_progress', progress }),
    )
    lastSource().dispatch('charge', message({ type: 'charge', payload }))

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(events.map((event) => event.type)).toEqual(['confirmation_progress', 'charge'])
  })

  it('accepts events from an EventSource polyfill that are not MessageEvent instances', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch('charge', polyfillEvent({ type: 'charge', payload }))
    lastSource().dispatch(
      'confirmation_progress',
      polyfillEvent({ type: 'confirmation_progress', progress }),
    )

    expect(events).toEqual([
      { type: 'charge', payload },
      { type: 'confirmation_progress', progress },
    ])
  })

  it('ignores events without string data', () => {
    const events: CheckoutEvent[] = []
    watchCheckoutEventsWithProgress('/events', (event) => events.push(event))

    lastSource().dispatch('charge', new Event('charge'))
    lastSource().dispatch('confirmation_progress', new Event('confirmation_progress'))

    expect(events).toEqual([])
  })

  it('stop() closes the EventSource', () => {
    const stop = watchCheckoutEventsWithProgress('/events', () => {})

    stop()

    expect(lastSource().closed).toBe(true)
  })
})
