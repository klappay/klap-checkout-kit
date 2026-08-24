<script setup lang="ts">
import { watch } from 'vue'
import { saveConfirming } from '@klappay/checkout-kit/client'
import type { PaymentOption } from '@klappay/checkout-kit/client'
import { useWalletConnectPayment } from '~/composables/useWalletConnectPayment'

const props = defineProps<{
  option: PaymentOption
  address: string
  chargeId: string
}>()

const emit = defineEmits<{
  sent: [txHash: string]
}>()

const { account, status, txHash, error, uri, connect, disconnect } = useWalletConnectPayment(
  props.option,
  props.address,
)

watch(txHash, (hash) => {
  if (!hash) return
  saveConfirming(props.chargeId, props.option.network, hash)
  emit('sent', hash)

  $fetch(`/api/checkout/${props.chargeId}/check`, {
    method: 'POST',
    body: { txHash: hash, network: props.option.network },
  }).catch((err) => console.error('checkCheckout failed', err))
})
</script>

<template>
  <div style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem">
    <p>
      Pay via <strong>{{ option.token }}</strong> on <strong>{{ option.network }}</strong> (WalletConnect)
    </p>
    <button
      v-if="!account"
      type="button"
      :disabled="status === 'awaiting-pairing' || status === 'paying'"
      @click="connect"
    >
      {{ status === 'awaiting-pairing' ? 'Waiting for wallet app…' : 'Pay with WalletConnect' }}
    </button>
    <button v-else type="button" @click="disconnect">Disconnect</button>
    <p v-if="uri" style="word-break: break-all">
      Scan or open in your wallet app:
      <code>{{ uri }}</code>
    </p>
    <p v-if="txHash">Sent: {{ txHash }}</p>
    <p v-if="error" style="color: red">Error: {{ error instanceof Error ? error.message : String(error) }}</p>
  </div>
</template>
