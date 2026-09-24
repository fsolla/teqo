import Image from 'next/image'
import Link from 'next/link'

import { CONTENT_PIECE_FOCUS } from './contentPieceClasses'

/**
 * S27 — the Central de Conteúdos bar (artefato: cenas 01/04/06/07/08): the
 * negative logo over the campaign red and, on a piece page, the way back to
 * the catalogue. Page-local, like the jingles header — not a site shell.
 *
 * S36 — the official lockup ships with a large transparent frame (canvas
 * 1037x595, visible ink 790x285: top 162, bottom 148, left 123, right 124),
 * so the header crops the frame with a fixed window instead of scaling the
 * whole canvas: 142x39 mobile (ink 186px, left -22 / top -29) and 188x50
 * desktop (ink 246px, left -29 / top -38), per docs/plans/central-conteudos-header-logo-ui-design.html.
 */
export const ContentPiecePageHeader = ({ backHref }: { backHref?: string }) => (
  <header className="bg-[#ae1603]">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-16 sm:px-8">
      <Link href="/" aria-label="Início — Jorge Solla 1313" className={CONTENT_PIECE_FOCUS}>
        <span className="relative block h-[39px] w-[142px] shrink-0 overflow-hidden sm:h-[50px] sm:w-[188px]">
          <Image
            src="/campaign-kit/jorge-solla-negativo.png"
            alt="Jorge Solla"
            width={1037}
            height={595}
            priority
            className="absolute top-[-29px] left-[-22px] h-auto w-[186px] max-w-none sm:top-[-38px] sm:left-[-29px] sm:w-[246px]"
          />
        </span>
      </Link>
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
