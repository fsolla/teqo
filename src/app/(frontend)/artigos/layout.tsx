import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignPageHeader } from '@/components/CampaignPageHeader'
import React from 'react'
import '../styles.css'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  // A root `(frontend)` trava o documento com `overflow-hidden`, então a rota
  // é dona do container de scroll interno. S47 — o chrome é o institucional
  // (cabeçalho/rodapé compartilhados em creme), não mais o header editorial
  // com a imagem de campanha.
  return (
    <div
      data-theme="campaign-site"
      className="relative h-dvh w-full overflow-y-auto bg-(--campaign-cream) text-(--campaign-ink)"
    >
      <CampaignPageHeader current="artigos" />
      {children}
      <CampaignFooter current="artigos" />
    </div>
  )
}
