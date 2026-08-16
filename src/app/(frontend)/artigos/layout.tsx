import { Footer } from '@/components/Footer'
import { SiteHeader } from '@/components/SiteHeader'
import React from 'react'
import '../styles.css'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  // A root `(frontend)` trava o documento com `overflow-hidden`, então a rota
  // é dona do container de scroll interno. Header sólido (não overlay) porque
  // /artigos é uma subpágina, não o hero da home.
  return (
    <div className="relative h-dvh w-full overflow-y-auto">
      <SiteHeader variant="solid" />
      {children}
      <Footer />
    </div>
  )
}
