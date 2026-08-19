import { createEventStream } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing charge id' })
  }

  const eventStream = createEventStream(event)
  const controller = new AbortController()
  eventStream.onClosed(() => controller.abort())

  const run = async () => {
    try {
      for await (const payload of checkout.watchCheckout(id, controller.signal)) {
        await eventStream.push({ event: 'charge', data: JSON.stringify(payload) })
      }
    } finally {
      await eventStream.close()
    }
  }
  run()

  return eventStream.send()
})
