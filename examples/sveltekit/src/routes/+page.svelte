<script lang="ts">
  let chargeId = ''
</script>

<svelte:head>
  <title>klap-checkout-kit — SvelteKit example</title>
</svelte:head>

<main>
  <h1>klap-checkout-kit SvelteKit example</h1>
  <p>
    This app demonstrates a custom Klappay crypto checkout built with
    <code>@klappay/checkout-kit</code> on top of SvelteKit — a server route that turns a charge
    into a <code>CheckoutPayload</code>, an SSE route for live status, a webhook route, and a
    checkout page that connects an injected wallet and pays.
  </p>

  <form on:submit|preventDefault={() => (window.location.href = `/checkout/${chargeId}`)}>
    <label for="chargeId">Charge ID</label>
    <input id="chargeId" name="chargeId" bind:value={chargeId} placeholder="ch_9f2a1c" required />
    <button type="submit">Go to checkout</button>
  </form>
</main>

<style>
  main {
    max-width: 32rem;
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }

  form {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  input {
    flex: 1;
    padding: 0.5rem;
  }
</style>
