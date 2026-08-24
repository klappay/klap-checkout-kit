// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      // Free registration at https://cloud.reown.com — required for the
      // WalletConnect payment option, see README.
      walletConnectProjectId: process.env.NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
    },
  },
})
