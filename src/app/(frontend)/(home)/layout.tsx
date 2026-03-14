import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import React from 'react'
import '../styles.css'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}
