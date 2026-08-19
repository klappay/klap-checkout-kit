import { error } from '@sveltejs/kit'
import type { CheckoutPayload } from '@klappay/checkout-kit/client'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/checkout/${params.id}`)

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    error(res.status, body?.error ?? 'Failed to load checkout')
  }

  const payload: CheckoutPayload = await res.json()
  return { chargeId: params.id, payload }
}
