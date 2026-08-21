const { createSwapPayment, getInjectedProvider, saveConfirming } = KlapCheckoutKit

function renderSwapAlternatives(payload, container, statusEl) {
  container.innerHTML = ''

  for (const alt of payload.swapAlternatives) {
    container.appendChild(renderSwapAlternative(payload, alt, statusEl))
  }
}

function renderSwapAlternative(payload, alt, statusEl) {
  const card = document.createElement('div')
  card.className = 'option'

  const title = document.createElement('p')
  title.textContent = `Or pay with ${alt.token} on ${alt.network} (swap-to-pay)`
  card.appendChild(title)

  const button = document.createElement('button')
  button.textContent = `Pay with ${alt.token}`
  card.appendChild(button)

  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      await payWithSwap(payload, alt, statusEl)
    } finally {
      button.disabled = false
    }
  })

  return card
}

async function payWithSwap(payload, alt, statusEl) {
  const provider = getInjectedProvider()
  if (!provider) {
    statusEl.textContent = 'No wallet extension found.'
    return
  }

  const [takerAddress] = await provider.request({ method: 'eth_requestAccounts' })

  const res = await fetch(`/api/checkout/${payload.id}/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputToken: alt.token, inputNetwork: alt.network, takerAddress }),
  })
  if (!res.ok) {
    statusEl.textContent = `Could not get a swap quote (${res.status}).`
    return
  }
  const quote = await res.json()

  const swap = createSwapPayment(quote, provider)
  swap.on('status', (status) => {
    statusEl.textContent = `Swap status: ${status}`
  })
  swap.on('approved', (txHash) => {
    statusEl.textContent = `Permit2 approved (tx ${txHash}) — continuing…`
  })
  swap.on('sent', (txHash) => {
    saveConfirming(payload.id, quote.outputNetwork, txHash)
    statusEl.textContent = `Sent — waiting for confirmation (tx ${txHash})`
  })
  swap.on('error', (error) => {
    statusEl.textContent = error?.code === 4001 ? 'Swap rejected in wallet.' : 'Swap failed — see console.'
    console.error(error)
  })

  await swap.connect()
  await swap.pay()
}
