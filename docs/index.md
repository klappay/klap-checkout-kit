---
layout: home

hero:
  name: '@klappay/checkout-kit'
  text: Build your own Klappay checkout UI
  tagline: Turn a Charge into what a payment UI needs, and talk to an injected wallet — without reimplementing either.
  image:
    src: /logo.png
    alt: '@klappay/checkout-kit'
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/klappay/klap-checkout-kit

features:
  - title: Node
    details: Turn a Charge into a CheckoutPayload — payable options, redirect URL, live status — from your own backend.
    link: /node
  - title: Client
    details: Connect an injected wallet, send the exact transaction, or render a QR — no DOM assumptions, bring your own UI.
    link: /client
  - title: Full checkout flow
    details: A complete connect → pay → confirm walkthrough, Node and client pieces wired together.
    link: /checkout-flow
  - title: Framework examples
    details: React, Vue, and Svelte — headless by design, drops into whatever reactivity system you already use.
    link: /frameworks
  - title: Full-stack examples
    details: Complete server + client integrations for Hono and Next.js.
    link: /examples
  - title: Webhooks
    details: Verify Core's signed X-Klappay-Signature deliveries, re-exported straight from @klappay/node.
    link: /webhooks
---
