<script setup lang="ts">
import { watch } from 'vue'
import { saveConfirming } from '@klappay/checkout-kit/client'
import type { Eip1193Provider, PaymentOption } from '@klappay/checkout-kit/client'
import { useWalletPayment } from '~/composables/useWalletPayment'

const props = defineProps<{
  option: PaymentOption
  address: string
  chargeId: string
  provider?: Eip1193Provider
}>()

const emit = defineEmits<{
  sent: [txHash: string]
}>()

const { account, status, txHash, error, connect, pay } = useWalletPayment(
  props.option,
  props.address,
  props.provider,
)

watch(txHash, (hash) => {
  if (!hash) return
  saveConfirming(props.chargeId, props.option.network, hash)
  emit('sent', hash)

  // Trigger an immediate on-chain re-check instead of waiting out the
  // ~60s background reconciliation pass — watchCheckoutEvents() above
  // still picks up the result either way.
  $fetch(`/api/checkout/${props.chargeId}/check`, {
    method: 'POST',
    body: { txHash: hash, network: props.option.network },
  }).catch((err) => console.error('checkCheckout failed', err))
})
</script>

<template>
  <div>
    <button v-if="!account" type="button" @click="connect">Connect wallet</button>
    <button v-else type="button" :disabled="status === 'paying'" @click="pay">
      {{ status === 'paying' ? 'Confirm in wallet…' : 'Pay now' }}
    </button>
    <p v-if="txHash">Sent: {{ txHash }}</p>
    <p v-if="error" style="color: red">Error: {{ error instanceof Error ? error.message : String(error) }}</p>
  </div>
</template>
