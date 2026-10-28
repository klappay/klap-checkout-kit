export type WalletConnectReconnectState = 'started' | 'recovered' | 'failed'

export type WalletConnectRelayer = {
  connected: boolean
  restartTransport(): Promise<void>
}

export type WatchRelayerReconnectOptions = {
  timeoutMs?: number
  hasSession?: () => boolean
}

export const RECONNECT_TIMEOUT_MS = 10_000

export function watchRelayerReconnect(
  relayer: WalletConnectRelayer,
  onStateChange: (state: WalletConnectReconnectState) => void,
  { timeoutMs = RECONNECT_TIMEOUT_MS, hasSession = () => true }: WatchRelayerReconnectOptions = {},
): () => void {
  if (typeof document === 'undefined') return () => {}

  let activeAttempt = 0
  let lastAttempt = 0
  let lastReported: WalletConnectReconnectState | null = null

  function report(state: WalletConnectReconnectState) {
    lastReported = state
    onStateChange(state)
  }

  function attempt() {
    if (activeAttempt !== 0 || !hasSession()) return
    if (relayer.connected) {
      if (lastReported === 'failed') report('recovered')
      return
    }
    const id = ++lastAttempt
    activeAttempt = id

    function finish(state: WalletConnectReconnectState) {
      if (activeAttempt !== id) return
      activeAttempt = 0
      clearTimeout(timeout)
      report(state)
    }

    const timeout = setTimeout(() => finish('failed'), timeoutMs)
    Promise.resolve()
      .then(() => relayer.restartTransport())
      .then(
        () => finish(relayer.connected ? 'recovered' : 'failed'),
        () => finish('failed'),
      )
    report('started')
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') attempt()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    activeAttempt = 0
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
