import type { ReactNode } from 'react'

export const metadata = {
  title: 'klap-checkout-kit — Next.js example',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
