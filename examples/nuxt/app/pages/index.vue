<script setup lang="ts">
const chargeId = ref('')
const router = useRouter()

function goToCheckout() {
  if (!chargeId.value.trim()) return
  router.push(`/checkout/${chargeId.value.trim()}`)
}
</script>

<template>
  <main style="max-width: 32rem; margin: 4rem auto; font-family: sans-serif; padding: 0 1rem">
    <h1>klap-checkout-kit — Nuxt example</h1>
    <p>
      This app demonstrates a full custom Klappay checkout built with
      <code>@klappay/checkout-kit</code> and Nuxt: Nitro server routes fetch and shape a
      <code>Charge</code> into a <code>CheckoutPayload</code>, stream live status over SSE, and
      verify inbound webhooks; a Vue page drives an injected wallet (<code>window.ethereum</code>)
      through connect &rarr; pay &rarr; confirm.
    </p>
    <form style="display: flex; gap: 0.5rem" @submit.prevent="goToCheckout">
      <input
        v-model="chargeId"
        type="text"
        placeholder="charge id, e.g. ch_9f2a1c"
        style="flex: 1; padding: 0.5rem"
      />
      <button type="submit">Open checkout</button>
    </form>
  </main>
</template>
