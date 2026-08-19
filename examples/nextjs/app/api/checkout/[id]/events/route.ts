import { checkout } from '@/lib/checkout-kit'

// Next.js has no streamSSE helper of its own — the SSE framing is built
// directly from a ReadableStream. req.signal is aborted when the client
// disconnects, and passing it into watchCheckout() is what actually tears
// down the underlying @klappay/node SSE connection to Core instead of
// leaving it open indefinitely.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const payload of checkout.watchCheckout(id, req.signal)) {
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
