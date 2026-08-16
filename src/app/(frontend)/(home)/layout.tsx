import React from 'react'
import '../styles.css'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  // A root `(frontend)` trava o documento com `overflow-hidden`, então a home
  // é dona do container de scroll interno. `data-theme="campaign-site"` aplica
  // a paleta da campanha (vermelho PT + amarelo CTA) aos tokens `--pt-*`.
  return (
    <div
      data-theme="campaign-site"
      className="relative h-dvh w-full scroll-smooth overflow-y-auto bg-(--campaign-cream) text-(--campaign-ink) motion-reduce:scroll-auto"
    >
      {children}
    </div>
  )
}
