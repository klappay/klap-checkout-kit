import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

export default defineConfig({
  title: '@klappay/checkout-kit',
  description:
    'Build a custom Klappay checkout — turn a Charge into what a payment UI needs, and talk to an injected wallet, without reimplementing either.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'force-dark',
  head: [['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }]],

  vite: {
    plugins: [llmstxt()],
  },

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting started', link: '/getting-started' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@klappay/checkout-kit' },
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Node', link: '/node' },
          { text: 'Client', link: '/client' },
          { text: 'Full checkout flow', link: '/checkout-flow' },
          { text: 'Framework examples', link: '/frameworks' },
          { text: 'Full-stack examples', link: '/examples' },
          { text: 'Webhooks', link: '/webhooks' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/klappay/klap-checkout-kit' }],

    footer: {
      message: 'Docs live in ./docs — the source of truth for both the package and this site.',
      copyright: 'MIT — Klappay',
    },
  },
})
