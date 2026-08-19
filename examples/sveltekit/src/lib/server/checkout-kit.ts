import { createCheckoutKit } from '@klappay/checkout-kit/node'
import { env } from '$env/dynamic/private'

export const checkout = createCheckoutKit({
  apiKey: env.KLAP_API_KEY!,
  baseUrl: env.KLAP_BASE_URL!,
})
