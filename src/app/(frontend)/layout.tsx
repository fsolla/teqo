import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import React from 'react'
import './styles.css'
import { RefreshRouteOnSave } from '@/utilities/RefreshRouteOnSave'
import { Metadata } from 'next'

export const metadata: Metadata = {
  description: 'Um template base usando Payload em uma aplicação Next.js.',
  title: 'Template Base do Payload',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="pt-BR">
      <body>
        <RefreshRouteOnSave />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
