import Image from 'next/image'
import Link from 'next/link'

import { CONTENT_PIECE_FOCUS } from './contentPieceClasses'

/**
 * S27 — the Central de Conteúdos bar (artefato: cenas 01/04/06/07/08): the
 * negative logo over the campaign red and, on a piece page, the way back to
 * the catalogue. Page-local, like the jingles header — not a site shell.
 */
export const ContentPiecePageHeader = ({ backHref }: { backHref?: string }) => (
  <header className="bg-[#ae1603]">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-16 sm:px-8">
      <Link href="/" aria-label="Início — Jorge Solla 1313" className={CONTENT_PIECE_FOCUS}>
        <Image
          src="/campaign-kit/jorge-solla-negativo.png"
          alt="Jorge Solla"
          width={1037}
          height={595}
          priority
          className="h-7 w-auto object-contain sm:h-9"
        />
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
