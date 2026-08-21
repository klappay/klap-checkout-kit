import { describe, expect, it } from 'vitest'
import { createEmitter } from './emitter'

type Events = {
  greet: (name: string) => void
  count: (n: number) => void
}

describe('createEmitter', () => {
  it('calls a listener with the emitted arguments', () => {
    const { emit, on } = createEmitter<Events>()
    const seen: string[] = []
    on('greet', (name) => seen.push(name))

    emit('greet', 'ada')

    expect(seen).toEqual(['ada'])
  })

  it('calls every listener registered for the same event', () => {
    const { emit, on } = createEmitter<Events>()
    const seen: number[] = []
    on('count', (n) => seen.push(n))
    on('count', (n) => seen.push(n * 10))

    emit('count', 3)

    expect(seen).toEqual([3, 30])
  })

  it('does not call a listener registered for a different event', () => {
    const { emit, on } = createEmitter<Events>()
    const seen: string[] = []
    on('greet', (name) => seen.push(name))

    emit('count', 3)

    expect(seen).toEqual([])
  })

  it('stops calling a listener after its unsubscribe function runs', () => {
    const { emit, on } = createEmitter<Events>()
    const seen: string[] = []
    const off = on('greet', (name) => seen.push(name))

    off()
    emit('greet', 'ada')

    expect(seen).toEqual([])
  })

  it('emitting with no listeners registered is a no-op', () => {
    const { emit } = createEmitter<Events>()
    expect(() => emit('greet', 'ada')).not.toThrow()
  })
})
