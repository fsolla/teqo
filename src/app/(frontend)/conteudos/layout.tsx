import React from 'react'

/**
 * S27 — the Central de Conteúdos shell. The root `(frontend)` layout locks the
 * document with `overflow-hidden`, so this segment owns the scroll container;
 * `campaign-site` applies the campaign palette, same contract as the jingles
 * page.
 */
export default function ConteudosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="campaign-site"
      className="h-dvh w-full overflow-y-auto bg-(--campaign-cream) text-(--campaign-ink)"
    >
      {children}
    </div>
  )
}
