// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  WalletConnectReconnectState,
  WalletConnectRelayer,
  WatchRelayerReconnectOptions,
} from './walletconnect-reconnect'
import { RECONNECT_TIMEOUT_MS, watchRelayerReconnect } from './walletconnect-reconnect'

let visibility: DocumentVisibilityState = 'visible'

function becomeVisible() {
  visibility = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
}

function becomeHidden() {
  visibility = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
}

function deferred() {
  let resolve: () => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function relayerWith(
  restart: (relayer: WalletConnectRelayer) => Promise<void>,
  connected = false,
): WalletConnectRelayer {
  const relayer: WalletConnectRelayer = {
    connected,
    restartTransport: vi.fn(() => restart(relayer)),
  }
  return relayer
}

async function reconnects(relayer: WalletConnectRelayer) {
  relayer.connected = true
}

let states: WalletConnectReconnectState[]
let stops: (() => void)[]

function watch(relayer: WalletConnectRelayer, options?: WatchRelayerReconnectOptions) {
  const stop = watchRelayerReconnect(relayer, (state) => states.push(state), options)
  stops.push(stop)
  return stop
}

beforeEach(() => {
  visibility = 'visible'
  states = []
  stops = []
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  for (const stop of stops) stop()
  vi.useRealTimers()
})

describe('watchRelayerReconnect', () => {
  it('does nothing until the page actually becomes visible', () => {
    const relayer = relayerWith(async () => {})
    watch(relayer)

    becomeHidden()

    expect(relayer.restartTransport).not.toHaveBeenCalled()
    expect(states).toEqual([])
  })

  it('does not restart a relayer that is still connected', () => {
    const relayer = relayerWith(async () => {}, true)
    watch(relayer)

    becomeVisible()

    expect(relayer.restartTransport).not.toHaveBeenCalled()
    expect(states).toEqual([])
  })

  it('reports started then recovered when the restart reconnects the relayer', async () => {
    const relayer = relayerWith(reconnects)
    watch(relayer)

    becomeVisible()

    await vi.waitFor(() => expect(states).toEqual(['started', 'recovered']))
    expect(relayer.restartTransport).toHaveBeenCalledTimes(1)
  })

  it('reports failed when the restart resolves but the relayer is still disconnected', async () => {
    const relayer = relayerWith(async () => {})
    watch(relayer)

    becomeVisible()

    await vi.waitFor(() => expect(states).toEqual(['started', 'failed']))
  })

  it('reports failed when the restart rejects', async () => {
    const relayer = relayerWith(async () => {
      throw new Error('socket closed')
    })
    watch(relayer)

    becomeVisible()

    await vi.waitFor(() => expect(states).toEqual(['started', 'failed']))
  })

  it('reports failed after the timeout and ignores a late recovery of that same attempt', async () => {
    vi.useFakeTimers()
    const pending = deferred()
    const relayer = relayerWith(() => pending.promise)
    watch(relayer)

    becomeVisible()
    await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS)
    pending.resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(states).toEqual(['started', 'failed'])
  })

  it('honors a custom timeout', async () => {
    vi.useFakeTimers()
    const relayer = relayerWith(() => deferred().promise)
    watch(relayer, { timeoutMs: 500 })

    becomeVisible()
    await vi.advanceTimersByTimeAsync(499)
    expect(states).toEqual(['started'])
    await vi.advanceTimersByTimeAsync(1)

    expect(states).toEqual(['started', 'failed'])
  })

  it('runs one restart at a time while repeated visibility changes arrive', async () => {
    const pending = deferred()
    const relayer = relayerWith((self) => pending.promise.then(() => reconnects(self)))
    watch(relayer)

    becomeVisible()
    becomeHidden()
    becomeVisible()
    pending.resolve()

    await vi.waitFor(() => expect(states).toEqual(['started', 'recovered']))
    expect(relayer.restartTransport).toHaveBeenCalledTimes(1)
  })

  it('a timed-out attempt resolving late cannot settle the next attempt', async () => {
    vi.useFakeTimers()
    const first = deferred()
    const second = deferred()
    const restarts = [first.promise, second.promise]
    const relayer = relayerWith(() => restarts.shift() ?? Promise.resolve())
    watch(relayer)

    becomeVisible()
    await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS)
    becomeVisible()
    first.resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(states).toEqual(['started', 'failed', 'started'])

    second.reject(new Error('still offline'))
    await vi.advanceTimersByTimeAsync(0)

    expect(states).toEqual(['started', 'failed', 'started', 'failed'])
    expect(relayer.restartTransport).toHaveBeenCalledTimes(2)
  })

  it('tries again on a later visibility change after a failed attempt', async () => {
    let attempts = 0
    const relayer = relayerWith(async (self) => {
      attempts++
      if (attempts === 1) throw new Error('offline')
      await reconnects(self)
    })
    watch(relayer)

    becomeVisible()
    await vi.waitFor(() => expect(states).toEqual(['started', 'failed']))
    becomeVisible()

    await vi.waitFor(() => expect(states).toEqual(['started', 'failed', 'started', 'recovered']))
  })

  it('stop() removes the listener and silences an attempt still in flight', async () => {
    const pending = deferred()
    const relayer = relayerWith(() => pending.promise)
    const stop = watch(relayer)

    becomeVisible()
    stop()
    pending.resolve()
    await Promise.resolve()
    becomeVisible()

    expect(states).toEqual(['started'])
    expect(relayer.restartTransport).toHaveBeenCalledTimes(1)
  })

  it('does not try to reconnect while there is no session to keep alive', () => {
    const relayer = relayerWith(reconnects)
    watch(relayer, { hasSession: () => false })

    becomeVisible()

    expect(relayer.restartTransport).not.toHaveBeenCalled()
    expect(states).toEqual([])
  })

  it('reports recovered on a later visibility change when the relayer came back on its own after a failure', async () => {
    vi.useFakeTimers()
    const relayer = relayerWith(() => deferred().promise)
    watch(relayer)

    becomeVisible()
    await vi.advanceTimersByTimeAsync(RECONNECT_TIMEOUT_MS)
    relayer.connected = true
    becomeVisible()
    becomeVisible()

    expect(states).toEqual(['started', 'failed', 'recovered'])
    expect(relayer.restartTransport).toHaveBeenCalledTimes(1)
  })

  it('keeps working when the state callback throws on "started"', async () => {
    const relayer = relayerWith(reconnects)
    const seen: WalletConnectReconnectState[] = []
    stops.push(
      watchRelayerReconnect(relayer, (state) => {
        seen.push(state)
        if (state === 'started') throw new Error('integrator bug')
      }),
    )

    const reported: unknown[] = []
    const onError = (event: ErrorEvent) => {
      event.preventDefault()
      reported.push(event.error)
    }
    window.addEventListener('error', onError)
    becomeVisible()
    window.removeEventListener('error', onError)

    expect(reported).toEqual([new Error('integrator bug')])

    await vi.waitFor(() => expect(seen).toEqual(['started', 'recovered']))
    expect(relayer.restartTransport).toHaveBeenCalledTimes(1)
  })
})
