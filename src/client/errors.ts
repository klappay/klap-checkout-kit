const USER_REJECTION_CODES: ReadonlySet<number> = new Set([4001, 5000])

const USER_REJECTION_MESSAGE = /user rejected|rejected by user|user denied/i

const MAX_CAUSE_DEPTH = 5

function readField(value: object, field: string): unknown {
  return field in value ? Reflect.get(value, field) : undefined
}

function isRejectionItself(error: object): boolean {
  const code = readField(error, 'code')
  if (typeof code === 'number' && USER_REJECTION_CODES.has(code)) return true
  const message = readField(error, 'message')
  return typeof message === 'string' && USER_REJECTION_MESSAGE.test(message)
}

export function isUserRejection(error: unknown): boolean {
  let current = error
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object' || current === null) return false
    if (isRejectionItself(current)) return true
    current = readField(current, 'cause')
  }
  return false
}
