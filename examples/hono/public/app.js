const {
  isWalletPayable,
  createWalletPayment,
  discoverProviders,
  buildPaymentUri,
  saveConfirming,
  getConfirming,
  clearConfirming,
  watchCheckoutEvents,
  resolveRedirectUrl,
  isOpenStatus,
} = KlapCheckoutKit

const chargeId = new URLSearchParams(location.search).get('charge') ?? 'test-id'

const statusEl = document.getElementById('status')
const optionsEl = document.getElementById('options')
const swapOptionsEl = document.getElementById('swap-options')

let stopWatching = null

async function main() {
  const res = await fetch(`/api/checkout/${chargeId}`)
  if (!res.ok) {
    statusEl.textContent = `Could not load charge "${chargeId}" (${res.status}). Pass a real charge id via ?charge=.`
    return
  }

  // Discovered once and reused for every payment option's picker — no
  // reason to redispatch the same eip6963:requestProvider event per option.
  const [payload, providers] = await Promise.all([res.json(), discoverProviders()])
  render(payload, providers)

  // A page reload loses in-memory wallet state, but not the fact that a
  // transaction was already sent — restore that from localStorage before
  // the SSE stream has a chance to catch up.
  const confirming = getConfirming(payload.id)
  if (confirming) {
    statusEl.textContent = `Waiting for confirmation on ${confirming.network} (tx ${confirming.txHash ?? 'pending'})…`
  }

  stopWatching = watchCheckoutEvents(`/api/checkout/${payload.id}/events`, (updated) => {
    render(updated, providers)

    if (isOpenStatus(updated.status)) return

    stopWatching?.()
    clearConfirming(updated.id)

    if (updated.status === 'confirmed') {
      const url = resolveRedirectUrl(updated.redirectUrl)
      if (url) {
        window.location.href = url
        return
      }
    }

    statusEl.textContent = `Charge ${updated.status}.`
  })
}

function render(payload, providers) {
  statusEl.textContent = `Status: ${payload.status}`
  optionsEl.innerHTML = ''

  for (const option of payload.paymentOptions) {
    optionsEl.appendChild(renderOption(payload, option, providers))
  }

  renderSwapAlternatives(payload, swapOptionsEl, statusEl)
}

function renderOption(payload, option, providers) {
  const card = document.createElement('div')
  card.className = 'option'

  const title = document.createElement('p')
  title.textContent = `${payload.amount} ${payload.currency} — ${option.token} on ${option.network}`
  card.appendChild(title)

  if (!isWalletPayable(option)) {
    const fallback = document.createElement('p')
    fallback.className = 'muted'
    fallback.textContent = `No wallet mapping for this network — send manually to ${payload.address}`
    card.appendChild(fallback)
    return card
  }

  const uri = document.createElement('p')
  uri.className = 'muted'
  uri.textContent = `Payment URI: ${buildPaymentUri(option, payload.address)}`
  card.appendChild(uri)

  const connectButton = document.createElement('button')
  connectButton.textContent = 'Connect wallet'
  card.appendChild(connectButton)

  if (providers.length < 2) {
    // 0 or 1 wallet found: no picker needed, same behavior as before —
    // createWalletPayment() defaults to getInjectedProvider().
    setupWallet(createWalletPayment(option, payload.address), payload, option, statusEl, connectButton)
    return card
  }

  // More than one EIP-6963-compliant wallet installed: let the payer
  // choose instead of silently using whichever claimed window.ethereum.
  connectButton.remove()
  const pickerEl = document.createElement('div')
  pickerEl.className = 'wallet-picker'
  card.appendChild(pickerEl)

  for (const { info, provider } of providers) {
    const walletButton = document.createElement('button')
    walletButton.className = 'wallet-choice'
    if (info.icon) {
      const icon = document.createElement('img')
      icon.src = info.icon
      icon.alt = ''
      icon.width = 20
      icon.height = 20
      walletButton.appendChild(icon)
    }
    walletButton.appendChild(document.createTextNode(info.name))
    walletButton.addEventListener('click', () => {
      pickerEl.innerHTML = ''
      card.appendChild(connectButton)
      setupWallet(createWalletPayment(option, payload.address, provider), payload, option, statusEl, connectButton)
    })
    pickerEl.appendChild(walletButton)
  }

  return card
}

function setupWallet(wallet, payload, option, statusEl, connectButton) {
  wallet.on('status', (status) => {
    connectButton.disabled = status === 'connecting' || status === 'paying'
    if (status === 'error') connectButton.textContent = 'Try again'
  })

  wallet.on('sent', (txHash) => {
    saveConfirming(payload.id, option.network, txHash)
    statusEl.textContent = `Sent — waiting for confirmation (tx ${txHash})`

    // Trigger an immediate on-chain re-check instead of waiting out the
    // ~60s background reconciliation pass — the SSE stream above still
    // picks up the result either way.
    fetch(`/api/checkout/${payload.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash, network: option.network }),
    }).catch((error) => console.error('checkCheckout failed', error))
  })

  wallet.on('error', (error) => {
    statusEl.textContent = error?.code === 4001 ? 'Payment rejected in wallet.' : 'Payment failed — see console.'
    console.error(error)
  })

  connectButton.addEventListener('click', async () => {
    if (!wallet.getStatus || wallet.getStatus() === 'idle') {
      await wallet.connect()
      connectButton.textContent = 'Pay now'
      connectButton.onclick = () => wallet.pay()
    }
  })
}

main().catch((err) => {
  statusEl.textContent = 'Something went wrong — see console.'
  console.error(err)
})
