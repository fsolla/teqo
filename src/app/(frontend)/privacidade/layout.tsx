import { Footer } from '@/components/Footer'
import { SiteHeader } from '@/components/SiteHeader'
import type { ReactNode } from 'react'

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="editorial" className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
