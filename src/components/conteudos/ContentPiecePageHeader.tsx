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
 * whole canvas. The window must have the SAME aspect ratio as the ink (the
 * frame does not); a mismatched window clips the base of "SOLLA" (production
 * report 2026-09-25). Window = ink box at the /jingles reference weight:
 * mobile 128x46 (img 167px -> ink 127.2x45.9, left -19.8 / top -26.1) and
 * desktop 144x52 (img 189px -> ink 144x51.9, left -22.4 / top -29.5).
 * To recompute after a kit PNG change: `sharp(asset).trim()` gives the ink box
 * (size + trimOffset); imgWidth = inkHeight x 1037/285 and the offsets are the
 * trim offsets x imgWidth/1037. The e2e spec asserts the fitted ink.
 */
export const ContentPiecePageHeader = ({ backHref }: { backHref?: string }) => (
  <header className="bg-[#ae1603]">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-16 sm:px-8">
      <Link href="/" aria-label="Início — Jorge Solla 1313" className={CONTENT_PIECE_FOCUS}>
        <span className="relative block h-[46px] w-[128px] shrink-0 overflow-hidden sm:h-[52px] sm:w-[144px]">
          <Image
            src="/campaign-kit/jorge-solla-negativo.png"
            alt="Jorge Solla"
            width={1037}
            height={595}
            priority
            className="absolute top-[-26.1px] left-[-19.8px] h-auto w-[167px] max-w-none sm:top-[-29.5px] sm:left-[-22.4px] sm:w-[189px]"
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
