import { KlapApiError } from '@klappay/node'
import { NextResponse } from 'next/server'
import { checkout } from '@/lib/checkout-kit'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const payload = await checkout.getCheckoutPayload(id)
    return NextResponse.json(payload)
  } catch (err) {
    if (err instanceof KlapApiError && err.status === 404) {
      return NextResponse.json({ error: 'charge not found' }, { status: 404 })
    }
    throw err
  }
}
