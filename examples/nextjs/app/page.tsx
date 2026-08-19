export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>klap-checkout-kit — Next.js example</h1>
      <p>
        This app demonstrates a full custom Klappay crypto checkout built with{' '}
        <code>@klappay/checkout-kit</code>: a server-side <code>/api/checkout/[id]</code> route
        that shapes a <code>Charge</code> into a <code>CheckoutPayload</code>, an SSE route for
        live status, a webhook handler, and a client-side wallet-connect checkout page.
      </p>
      <p>
        To try it, create a charge against your own Klappay API key and visit{' '}
        <code>/checkout/&lt;chargeId&gt;</code> — for example{' '}
        <a href="/checkout/ch_9f2a1c">/checkout/ch_9f2a1c</a> (replace{' '}
        <code>ch_9f2a1c</code> with a real charge id from your account).
      </p>
      <p>
        See this repo's <code>README.md</code> for setup instructions, and{' '}
        <code>docs/checkout-flow.md</code> in the <code>klap-checkout-kit</code> package for the
        full walkthrough.
      </p>
    </main>
  )
}
