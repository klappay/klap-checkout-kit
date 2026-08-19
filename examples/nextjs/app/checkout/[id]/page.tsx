import { CheckoutButton } from './CheckoutButton'

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Checkout</h1>
      <CheckoutButton chargeId={id} />
    </main>
  )
}
