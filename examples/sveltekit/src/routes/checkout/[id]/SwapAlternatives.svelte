<script lang="ts">
  import type { SwapAlternative } from '@klappay/checkout-kit/client'
  import { createSwapStore } from '$lib/swap-store'

  export let chargeId: string
  export let swapAlternatives: SwapAlternative[]

  const { status, txHash, error, pay } = createSwapStore(chargeId)
  const busyStatuses = new Set(['connecting', 'checking-allowance', 'approving', 'signing', 'paying'])
</script>

{#if swapAlternatives.length > 0}
  <section>
    <h2>Pay with a different crypto</h2>
    {#each swapAlternatives as alt (alt.token + alt.network)}
      <button type="button" on:click={() => pay(alt)} disabled={busyStatuses.has($status)}>
        Pay with {alt.token} on {alt.network}
      </button>
    {/each}
    {#if $status !== 'idle'}
      <p>Swap status: {$status}</p>
    {/if}
    {#if $txHash}
      <p>Sent: {$txHash}</p>
    {/if}
    {#if $error}
      <p class="error">Swap error: {String($error)}</p>
    {/if}
  </section>
{/if}

<style>
  section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
  }

  .error {
    color: #b00020;
  }
</style>
