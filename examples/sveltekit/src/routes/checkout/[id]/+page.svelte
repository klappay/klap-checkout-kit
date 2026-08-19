<script lang="ts">
  import { onMount } from 'svelte'
  import type { Writable } from 'svelte/store'
  import {
    buildPaymentUri,
    clearConfirming,
    confirmingExplorerUrl,
    getConfirming,
    isOpenStatus,
    isWalletPayable,
    remainingMs,
    resolveRedirectUrl,
    saveConfirming,
    watchCheckoutEvents,
  } from '@klappay/checkout-kit/client'
  import type { CheckoutPayload, ConfirmingRecord, PaymentOption, WalletStatus } from '@klappay/checkout-kit/client'
  import { createWalletStore } from '$lib/wallet-store'
  import type { PageData } from './$types'

  export let data: PageData

  let payload: CheckoutPayload = data.payload
  let confirming: ConfirmingRecord | null = getConfirming(payload.id)

  const walletOptions = payload.paymentOptions.filter(isWalletPayable)
  const manualOptions = payload.paymentOptions.filter((option) => !isWalletPayable(option))
  const primaryOption: PaymentOption | null = walletOptions[0] ?? null

  let account: Writable<string | null> | null = null
  let status: Writable<WalletStatus> | null = null
  let txHash: Writable<string | null> | null = null
  let walletError: Writable<unknown> | null = null
  let connect: (() => Promise<string>) | null = null
  let pay: (() => Promise<string>) | null = null

  if (primaryOption) {
    const store = createWalletStore(primaryOption, payload.address)
    account = store.account
    status = store.status
    txHash = store.txHash
    walletError = store.error
    connect = store.connect
    pay = store.pay
  }

  onMount(() => {
    const unsubscribe = txHash?.subscribe((hash) => {
      if (!hash || !primaryOption) return
      saveConfirming(payload.id, primaryOption.network, hash)
      confirming = getConfirming(payload.id)
    })

    const stopWatching = watchCheckoutEvents(`/api/checkout/${payload.id}/events`, (updated) => {
      payload = updated

      if (isOpenStatus(updated.status)) return

      stopWatching()
      clearConfirming(updated.id)
      confirming = null

      if (updated.status === 'confirmed') {
        const redirect = resolveRedirectUrl(updated.redirectUrl)
        if (redirect) window.location.href = redirect
      }
    })

    return () => {
      unsubscribe?.()
      stopWatching()
    }
  })
</script>

<svelte:head>
  <title>Checkout {payload.id}</title>
</svelte:head>

<main>
  <h1>Checkout {payload.id}</h1>
  <p>Status: <strong>{payload.status}</strong></p>
  <p>
    Amount: {payload.amount}
    {payload.currency}
  </p>

  {#if confirming}
    <div class="confirming">
      <p>Waiting for confirmation on {confirming.network}…</p>
      <p>{Math.max(0, Math.round(remainingMs(confirming) / 1000))}s left</p>
      {#if confirmingExplorerUrl(confirming)}
        <a href={confirmingExplorerUrl(confirming) ?? undefined} target="_blank" rel="noreferrer">
          View on block explorer
        </a>
      {/if}
    </div>
  {/if}

  {#if primaryOption && account && status && connect && pay}
    <section>
      <h2>Pay with wallet</h2>
      <p>
        {primaryOption.token} on {primaryOption.network}
      </p>
      {#if !$account}
        <button type="button" on:click={connect}>Connect wallet</button>
      {:else}
        <button type="button" on:click={pay} disabled={$status === 'paying'}>
          {$status === 'paying' ? 'Confirm in wallet…' : 'Pay now'}
        </button>
      {/if}
      {#if $txHash}
        <p>Sent: {$txHash}</p>
      {/if}
      {#if $walletError}
        <p class="error">Wallet error: {String($walletError)}</p>
      {/if}
      <p class="uri">{buildPaymentUri(primaryOption, payload.address)}</p>
    </section>
  {/if}

  {#if manualOptions.length > 0}
    <section>
      <h2>Pay manually</h2>
      <p>No wallet mapping for these — send directly to the address below:</p>
      {#each manualOptions as option (option.token + option.network)}
        <p>
          {option.token} on {option.network}: <code>{payload.address}</code>
        </p>
      {/each}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 32rem;
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }

  section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
  }

  .confirming {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fffbe6;
    border: 1px solid #f0d878;
    border-radius: 0.25rem;
  }

  .uri {
    word-break: break-all;
    font-size: 0.8rem;
    color: #666;
  }

  .error {
    color: #b00020;
  }
</style>
