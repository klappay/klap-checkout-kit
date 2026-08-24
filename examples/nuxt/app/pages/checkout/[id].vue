<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  buildPaymentUri,
  clearConfirming,
  confirmingExplorerUrl,
  getConfirming,
  isOpenStatus,
  isWalletPayable,
  remainingMs,
  resolveRedirectUrl,
  watchCheckoutEvents,
} from '@klappay/checkout-kit/client'
import type { CheckoutPayload, ConfirmingRecord } from '@klappay/checkout-kit/client'

const route = useRoute()
const chargeId = route.params.id as string

const { data: payload, error: fetchError } = await useFetch<CheckoutPayload>(`/api/checkout/${chargeId}`)

const confirming = ref<ConfirmingRecord | null>(null)
let stopWatching: (() => void) | null = null

function applyPayload(updated: CheckoutPayload) {
  payload.value = updated

  if (isOpenStatus(updated.status)) return

  stopWatching?.()
  clearConfirming(updated.id)
  confirming.value = null

  if (updated.status === 'confirmed') {
    const url = resolveRedirectUrl(updated.redirectUrl)
    if (url) window.location.href = url
  }
}

onMounted(() => {
  confirming.value = getConfirming(chargeId)
  stopWatching = watchCheckoutEvents(`/api/checkout/${chargeId}/events`, applyPayload)
})

onUnmounted(() => {
  stopWatching?.()
})

function onSent(txHash: string) {
  confirming.value = getConfirming(chargeId)
  console.log('sent', txHash)
}
</script>

<template>
  <main style="max-width: 32rem; margin: 4rem auto; font-family: sans-serif; padding: 0 1rem">
    <h1>Checkout {{ chargeId }}</h1>

    <p v-if="fetchError">Could not load this charge ({{ fetchError.message }}).</p>

    <template v-else-if="payload">
      <p>
        {{ payload.amount }} {{ payload.currency }} &mdash; status:
        <strong>{{ payload.status }}</strong>
      </p>

      <p v-if="confirming">
        Confirming on {{ confirming.network }}, {{ Math.max(0, Math.round(remainingMs(confirming) / 1000)) }}s
        left.
        <a v-if="confirmingExplorerUrl(confirming)" :href="confirmingExplorerUrl(confirming)!" target="_blank">
          View transaction
        </a>
      </p>

      <div v-for="option in payload.paymentOptions" :key="`${option.token}-${option.network}`">
        <template v-if="isWalletPayable(option)">
          <WalletPaymentButton :option="option" :address="payload.address" :charge-id="payload.id" @sent="onSent" />
          <WalletConnectPaymentButton
            :option="option"
            :address="payload.address"
            :charge-id="payload.id"
            @sent="onSent"
          />
          <p style="color: #666; font-size: 0.85em; margin-top: -0.5rem">
            QR fallback: <code>{{ buildPaymentUri(option, payload.address) }}</code>
          </p>
        </template>
        <div v-else style="border: 1px dashed #ccc; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem">
          <p>
            Send <strong>{{ option.token }}</strong> on <strong>{{ option.network }}</strong> directly to:
          </p>
          <code>{{ payload.address }}</code>
          <p style="color: #666; font-size: 0.9em">
            No wallet chain mapping for this pair yet — still payable by sending to the address above
            directly (or via QR).
          </p>
        </div>
      </div>

      <template v-if="payload.swapAlternatives.length > 0">
        <h2>Pay with a different crypto</h2>
        <SwapPaymentButton
          v-for="alt in payload.swapAlternatives"
          :key="`${alt.token}-${alt.network}`"
          :alt="alt"
          :charge-id="payload.id"
        />
      </template>
    </template>

    <p v-else>Loading…</p>
  </main>
</template>
