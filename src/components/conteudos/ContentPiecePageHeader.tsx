import Link from 'next/link'

import { CampaignLogoLink } from '@/components/CampaignLogoLink'

import { CONTENT_PIECE_FOCUS } from './contentPieceClasses'

/**
 * S27 — the Central de Conteúdos bar (artefato: cenas 01/04/06/07/08): the
 * negative logo over the campaign red and, on a piece page, the way back to the
 * catalogue. Page-local, like the jingles header — not a site shell. The lockup
 * crop contract lives in `CampaignLogoLink`, shared with the C233 album header.
 */
export const ContentPiecePageHeader = ({ backHref }: { backHref?: string }) => (
  <header className="bg-[#ae1603]">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-16 sm:px-8">
      <CampaignLogoLink className={CONTENT_PIECE_FOCUS} />
      {backHref ? (
        <Link
          href={backHref}
          className={`rounded-sm text-sm font-bold text-white underline-offset-4 hover:underline ${CONTENT_PIECE_FOCUS}`}
        >
          Voltar à Central
        </Link>
      ) : (
        <span className="text-sm font-bold text-white">Central de Conteúdos</span>
      )}
    </div>
  </header>
)
