<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { discoverProviders } from '@klappay/checkout-kit/client'
import type { Eip1193Provider, Eip6963ProviderDetail, PaymentOption } from '@klappay/checkout-kit/client'
import WalletPaymentButtonInner from './WalletPaymentButtonInner.vue'

const props = defineProps<{
  option: PaymentOption
  address: string
  chargeId: string
}>()

defineEmits<{
  sent: [txHash: string]
}>()

const providers = ref<Eip6963ProviderDetail[]>([])
const chosenProvider = ref<Eip1193Provider | undefined>(undefined)
const ready = ref(false)

onMounted(async () => {
  providers.value = await discoverProviders()
  ready.value = true
})
</script>

<template>
  <div style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem">
    <p>Pay via <strong>{{ option.token }}</strong> on <strong>{{ option.network }}</strong></p>

    <p v-if="!ready" class="muted">Checking for installed wallets…</p>

    <div v-else-if="providers.length >= 2 && !chosenProvider">
      <p>More than one wallet found — choose one:</p>
      <button
        v-for="{ info, provider } in providers"
        :key="info.uuid"
        type="button"
        @click="chosenProvider = provider"
      >
        <img v-if="info.icon" :src="info.icon" alt="" width="20" height="20" />
        {{ info.name }}
      </button>
    </div>

    <WalletPaymentButtonInner
      v-else
      :option="option"
      :address="address"
      :charge-id="chargeId"
      :provider="chosenProvider"
      @sent="(hash) => $emit('sent', hash)"
    />
  </div>
</template>
