export function assertServerOnly(moduleName: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `@klappay/checkout-kit/node (${moduleName}) holds your API key and must never run in a browser bundle — use @klappay/checkout-kit/client there instead.`,
    )
  }
}
