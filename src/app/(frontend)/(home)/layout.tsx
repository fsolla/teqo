import { Footer } from '@/components/Footer'
import { SiteHeader } from '@/components/SiteHeader'
import React from 'react'
import '../styles.css'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  // The root `(frontend)` layout locks the document with `overflow-hidden`, so
  // the home route owns an internal scroll container. `relative` anchors the
  // overlay header over the hero.
  return (
    <div className="relative h-dvh w-full overflow-y-auto">
      <SiteHeader variant="overlay" />
      {children}
      <Footer />
    </div>
  )
}
