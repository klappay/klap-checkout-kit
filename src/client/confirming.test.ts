// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearConfirming,
  confirmingExplorerUrl,
  getConfirming,
  remainingMs,
  saveConfirming,
} from './confirming'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saveConfirming / getConfirming', () => {
  it('round-trips a confirming record through localStorage', () => {
    saveConfirming('ch_1', 'base', '0xhash')
    expect(getConfirming('ch_1')).toMatchObject({ network: 'base', txHash: '0xhash' })
  })

  it('returns null once the network timeout has elapsed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    saveConfirming('ch_1', 'avalanche', null)

    vi.setSystemTime(60_000 + 1)
    expect(getConfirming('ch_1')).toBeNull()
  })

  it('clears the record it just expired instead of leaving it stale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    saveConfirming('ch_1', 'avalanche', null)
    vi.setSystemTime(60_000 + 1)
    getConfirming('ch_1')

    expect(localStorage.getItem('klap:confirming:ch_1')).toBeNull()
  })
})

describe('clearConfirming', () => {
  it('removes a saved record', () => {
    saveConfirming('ch_1', 'base', null)
    clearConfirming('ch_1')
    expect(getConfirming('ch_1')).toBeNull()
  })
})

describe('remainingMs', () => {
  it('falls back to the ethereum timeout for an unknown network', () => {
    const record = { network: 'ethereum' as const, startedAt: Date.now(), txHash: null }
    expect(remainingMs(record)).toBeGreaterThan(14 * 60 * 1000)
  })
})

describe('confirmingExplorerUrl', () => {
  it('returns null when there is no tx hash yet', () => {
    expect(
      confirmingExplorerUrl({ network: 'base', startedAt: Date.now(), txHash: null }),
    ).toBeNull()
  })

  it('builds an explorer link for the network once a tx hash exists', () => {
    const url = confirmingExplorerUrl({ network: 'base', startedAt: Date.now(), txHash: '0xhash' })
    expect(url).toBe('https://basescan.org/tx/0xhash')
  })
})
