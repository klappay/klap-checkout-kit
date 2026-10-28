---
"@klappay/checkout-kit": minor
---

`createWalletConnectProvider()` (`/client/walletconnect`) can now resume a session after a reload and recover a dropped relay connection:

- `restore(chainId?)` returns a provider for the session WalletConnect persisted in the browser, with no QR code or wallet prompt, or `null` when there's no usable session (none saved, expired, or no approved account on that chain). Pair it with `wallet.reconnect()`.
- `on('disconnect', ...)` fires when the session ends without you ending it: the payer disconnected in their wallet, or the session expired.
- `watchReconnect(onStateChange)` restarts the relay socket when the page becomes visible again (mobile browsers drop it while the payer is in their wallet app), reporting `'started'` and then `'recovered'` or `'failed'`. It only listens once called, stays idle until there's a session, and is a no-op without a `document`.
