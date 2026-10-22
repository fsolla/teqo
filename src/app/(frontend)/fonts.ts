import { Arimo, Exo_2 } from 'next/font/google'

/**
 * Campanha 2026 — Exo 2 display (títulos/CTAs) e Arimo (texto), as duas faces
 * OFL self-hosted do site. Vivem aqui (não no layout) desde o S46: a página
 * pública do story passa a família ao canvas do cliente, e o `(frontend)`
 * layout consome as mesmas instâncias — uma só, sem preload duplicado.
 */
export const campaignDisplayFont = Exo_2({ subsets: ['latin'], variable: '--font-exo2' })
export const campaignTextFont = Arimo({ subsets: ['latin'], variable: '--font-arimo' })
