export function resolveRedirectUrl(redirectUrl: string | null): string | null {
  if (!redirectUrl) return null
  try {
    const url = new URL(redirectUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? redirectUrl : null
  } catch {
    return null
  }
}
