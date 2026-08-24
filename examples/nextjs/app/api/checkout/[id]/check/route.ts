import { KlapApiError } from '@klappay/node'
import { NextResponse } from 'next/server'
import type { CheckChargeRequest } from '@klappay/checkout-kit/node'
import { checkout } from '@/lib/checkout-kit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const input: CheckChargeRequest | undefined = await req.json().catch(() => undefined)

  try {
    const payload = await checkout.checkCheckout(id, input)
    return NextResponse.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 404) return NextResponse.json({ error: 'charge not found' }, { status: 404 })
      if (err.status === 422 || err.status === 429 || err.status === 503) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
    }
    throw err
  }
}
