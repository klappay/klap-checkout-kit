import { createCheckoutKit } from '@klappay/checkout-kit/node'

export const checkout = createCheckoutKit({
  apiKey: process.env.KLAP_API_KEY!,
  baseUrl: process.env.KLAP_BASE_URL!,
})
