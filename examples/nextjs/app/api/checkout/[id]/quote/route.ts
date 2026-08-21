import { KlapApiError } from '@klappay/node'
import { NextResponse } from 'next/server'
import type { CreateSwapQuoteInput } from '@klappay/checkout-kit/node'
import { checkout } from '@/lib/checkout-kit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const input: CreateSwapQuoteInput = await req.json()

  try {
    const quote = await checkout.getSwapQuote(id, input)
    return NextResponse.json(quote)
  } catch (err) {
    if (err instanceof KlapApiError) {
      if (err.status === 422 || err.status === 409 || err.status === 429 || err.status === 503) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
    }
    throw err
  }
}
