<script setup lang="ts">
import { computed, watch } from 'vue'
import { saveConfirming } from '@klappay/checkout-kit/client'
import type { SwapAlternative } from '@klappay/checkout-kit/client'
import { useSwapPayment } from '~/composables/useSwapPayment'

const props = defineProps<{
  alt: SwapAlternative
  chargeId: string
}>()

const { status, txHash, error, pay } = useSwapPayment(props.chargeId)

const busy = computed(() =>
  ['connecting', 'checking-allowance', 'approving', 'signing', 'paying'].includes(status.value),
)

watch(txHash, (hash) => {
  if (!hash) return
  saveConfirming(props.chargeId, props.alt.network, hash)
})
</script>

<template>
  <div style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem">
    <p>
      Pay with <strong>{{ alt.token }}</strong> on <strong>{{ alt.network }}</strong> (swap-to-pay)
    </p>
    <button type="button" :disabled="busy" @click="pay(alt)">
      {{ busy ? `${status}…` : `Pay with ${alt.token}` }}
    </button>
    <p v-if="txHash">Sent: {{ txHash }}</p>
    <p v-if="error" style="color: red">Error: {{ error instanceof Error ? error.message : String(error) }}</p>
  </div>
</template>
