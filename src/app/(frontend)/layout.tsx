import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Um template base usando Payload em uma aplicação Next.js.',
  title: 'Template Base do Payload',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
