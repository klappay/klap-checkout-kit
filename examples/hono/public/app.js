const {
  isWalletPayable,
  createWalletPayment,
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

  const payload = await res.json()
  render(payload)

  // A page reload loses in-memory wallet state, but not the fact that a
  // transaction was already sent — restore that from localStorage before
  // the SSE stream has a chance to catch up.
  const confirming = getConfirming(payload.id)
  if (confirming) {
    statusEl.textContent = `Waiting for confirmation on ${confirming.network} (tx ${confirming.txHash ?? 'pending'})…`
  }

  stopWatching = watchCheckoutEvents(`/api/checkout/${payload.id}/events`, (updated) => {
    render(updated)

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

function render(payload) {
  statusEl.textContent = `Status: ${payload.status}`
  optionsEl.innerHTML = ''

  for (const option of payload.paymentOptions) {
    optionsEl.appendChild(renderOption(payload, option))
  }

  renderSwapAlternatives(payload, swapOptionsEl, statusEl)
}

function renderOption(payload, option) {
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

  const wallet = createWalletPayment(option, payload.address)

  wallet.on('status', (status) => {
    connectButton.disabled = status === 'connecting' || status === 'paying'
    if (status === 'error') connectButton.textContent = 'Try again'
  })

  wallet.on('sent', (txHash) => {
    saveConfirming(payload.id, option.network, txHash)
    statusEl.textContent = `Sent — waiting for confirmation (tx ${txHash})`
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

  return card
}

main().catch((err) => {
  statusEl.textContent = 'Something went wrong — see console.'
  console.error(err)
})
