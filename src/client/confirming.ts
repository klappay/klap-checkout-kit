import { NETWORK_EXPLORERS } from '@klappay/types/constants'
import type { Network } from '../types'

export type ConfirmingRecord = { network: Network; startedAt: number; txHash: string | null }

const TIMEOUT_MS: Record<Network, number> = {
  ethereum: 15 * 60 * 1000,
  polygon: 5 * 60 * 1000,
  base: 2 * 60 * 1000,
  optimism: 2 * 60 * 1000,
  arbitrum: 2 * 60 * 1000,
  bnb: 2 * 60 * 1000,
  avalanche: 60 * 1000,
}

function storageKey(chargeId: string): string {
  return `klap:confirming:${chargeId}`
}

export function remainingMs(record: ConfirmingRecord): number {
  const timeout = TIMEOUT_MS[record.network] ?? TIMEOUT_MS.ethereum
  return timeout - (Date.now() - record.startedAt)
}

export function confirmingExplorerUrl(record: ConfirmingRecord): string | null {
  if (!record.txHash) return null
  const base = NETWORK_EXPLORERS[record.network]
  return base ? `${base}/tx/${record.txHash}` : null
}

export function clearConfirming(chargeId: string): void {
  try {
    localStorage.removeItem(storageKey(chargeId))
  } catch {}
}

export function saveConfirming(
  chargeId: string,
  network: Network,
  txHash: string | null,
): ConfirmingRecord {
  const record: ConfirmingRecord = { network, startedAt: Date.now(), txHash }
  try {
    localStorage.setItem(storageKey(chargeId), JSON.stringify(record))
  } catch {}
  return record
}

export function getConfirming(chargeId: string): ConfirmingRecord | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(storageKey(chargeId))
  } catch {
    return null
  }
  if (!raw) return null

  let record: ConfirmingRecord
  try {
    record = JSON.parse(raw)
  } catch {
    clearConfirming(chargeId)
    return null
  }

  if (remainingMs(record) <= 0) {
    clearConfirming(chargeId)
    return null
  }
  return record
}
