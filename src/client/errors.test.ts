import { describe, expect, it } from 'vitest'
import { isUserRejection } from './errors'

function providerError(code: number, message = 'error'): Error & { code: number } {
  return Object.assign(new Error(message), { code })
}

describe('isUserRejection', () => {
  it('is true for EIP-1193 code 4001 (user rejected the request)', () => {
    expect(isUserRejection(providerError(4001))).toBe(true)
  })

  it('is true for WalletConnect code 5000 (USER_REJECTED)', () => {
    expect(isUserRejection(providerError(5000))).toBe(true)
  })

  it('is true for a plain { code } object, not only Error instances', () => {
    expect(isUserRejection({ code: 4001, message: 'x' })).toBe(true)
  })

  it.each([
    'MetaMask Tx Signature: User denied transaction signature.',
    'User rejected the request.',
    'Transaction was rejected by user',
  ])('is true for a rejection message with no recognized code: %s', (message) => {
    expect(isUserRejection(new Error(message))).toBe(true)
  })

  it('walks the cause chain of a wrapped provider error', () => {
    const wrapped = new Error('Request failed', {
      cause: new Error('Execution failed', { cause: providerError(4001) }),
    })

    expect(isUserRejection(wrapped)).toBe(true)
  })

  it('stops walking a cause chain deeper than its bound', () => {
    let error: unknown = providerError(4001)
    for (let i = 0; i < 10; i++) error = new Error('wrapper', { cause: error })

    expect(isUserRejection(error)).toBe(false)
  })

  it('terminates on a self-referencing cause', () => {
    const error: Error & { cause?: unknown } = new Error('loop')
    error.cause = error

    expect(isUserRejection(error)).toBe(false)
  })

  it.each([
    [-32000, 'generic JSON-RPC server error'],
    [-32602, 'invalid params'],
    [-32603, 'internal error'],
    [4100, 'unauthorized'],
    [4902, 'unrecognized chain'],
  ])('is false for code %i (%s)', (code) => {
    expect(isUserRejection(providerError(code, 'something went wrong'))).toBe(false)
  })

  it('is false for a string code that only looks like 4001', () => {
    expect(isUserRejection({ code: '4001', message: 'x' })).toBe(false)
  })

  it.each([undefined, null, 'User rejected the request.', 4001, true])(
    'is false for a non-object value: %s',
    (value) => {
      expect(isUserRejection(value)).toBe(false)
    },
  )
})
