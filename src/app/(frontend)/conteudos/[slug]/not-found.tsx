import { XCircleIcon } from 'lucide-react'
import Link from 'next/link'

import { ContentPiecePageHeader } from '@/components/conteudos/ContentPiecePageHeader'
import { CONTENT_PIECE_PRIMARY_BUTTON } from '@/components/conteudos/contentPieceClasses'
import { CONTENT_PIECE_CATALOG_PATH } from '@/lib/contentPieceCatalog'

/**
 * S27 — the same friendly screen for an unpublished piece and an unknown slug
 * (artefato: cena 05): the link is gone and the page does not reveal whether
 * the piece existed.
 */
export default function ContentPieceNotFound() {
  return (
    <>
      <ContentPiecePageHeader backHref={CONTENT_PIECE_CATALOG_PATH} />
      <main className="flex min-h-[60vh] w-full items-center justify-center px-5 py-16 sm:px-8">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-(--campaign-band) text-(--campaign-muted)">
            <XCircleIcon className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.02em] sm:text-3xl">
            Esta peça não está disponível
          </h1>
          <p className="mx-auto mt-3 max-w-[48ch] text-base leading-7 text-(--campaign-muted)">
            Ela pode ter sido retirada. Encontre outro material oficial e continue pedindo voto.
          </p>
          <Link
            href={CONTENT_PIECE_CATALOG_PATH}
            className={`${CONTENT_PIECE_PRIMARY_BUTTON} mt-6`}
          >
            Ver outras peças
          </Link>
        </div>
      </main>
    </>
  )
}
