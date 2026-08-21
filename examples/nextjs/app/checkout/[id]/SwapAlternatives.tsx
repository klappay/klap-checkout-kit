'use client'

import type { CheckoutPayload } from '@klappay/checkout-kit/client'
import { useSwapPayment } from './swap-hooks'

const BUSY_STATUSES = new Set([
  'connecting',
  'checking-allowance',
  'approving',
  'signing',
  'paying',
])

export function SwapAlternatives({ payload }: { payload: CheckoutPayload }) {
  const { status, txHash, error, pay } = useSwapPayment(payload.id)

  if (payload.swapAlternatives.length === 0) return null

  return (
    <div>
      <p>Or pay with a different crypto:</p>
      {payload.swapAlternatives.map((alt) => (
        <button
          key={`${alt.token}-${alt.network}`}
          onClick={() => pay(alt)}
          disabled={BUSY_STATUSES.has(status)}
        >
          Pay with {alt.token} on {alt.network}
        </button>
      ))}
      {status !== 'idle' && <p>Swap status: {status}</p>}
      {txHash && <p>Sent: {txHash}</p>}
      {error != null && <p>Swap failed. Please try again.</p>}
    </div>
  )
}
