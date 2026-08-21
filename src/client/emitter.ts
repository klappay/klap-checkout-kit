export function createEmitter<Events extends Record<string, (...args: never[]) => void>>() {
  const listeners = new Map<keyof Events, Set<(...args: never[]) => void>>()

  function emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    for (const listener of listeners.get(event) ?? [])
      (listener as (...a: unknown[]) => void)(...args)
  }

  function on<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    const set = listeners.get(event) ?? new Set()
    set.add(listener as (...args: never[]) => void)
    listeners.set(event, set)
    return () => set.delete(listener as (...args: never[]) => void)
  }

  return { emit, on }
}
