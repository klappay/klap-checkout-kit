import { checkout } from '$lib/server/checkout-kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, request }) => {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const payload of checkout.watchCheckout(params.id, request.signal)) {
          controller.enqueue(encoder.encode(`event: charge\ndata: ${JSON.stringify(payload)}\n\n`))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
