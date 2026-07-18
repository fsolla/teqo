import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'

import { VoteEstimateFocusProvider } from '@/components/campaign/VoteEstimateFocusProvider'

import '../(frontend)/styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CampanhaRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="campaign"
      className={inter.variable}
      style={{ colorScheme: 'light' }}
    >
      <body className="bg-background bg-none text-foreground antialiased">
        <VoteEstimateFocusProvider>{children}</VoteEstimateFocusProvider>
      </body>
    </html>
  )
}
