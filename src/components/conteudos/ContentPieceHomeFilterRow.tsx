import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

import { isContentPieceType } from '@/lib/contentPiece'
import {
  buildContentPieceCatalogHref,
  contentPieceCatalogFacetLabels,
  type ContentPieceCatalogFacets,
} from '@/lib/contentPieceCatalog'
import { cn } from '@/lib/utils'

import { CONTENT_PIECE_FOCUS } from './contentPieceClasses'

/**
 * S42 — the facets of the home section's explore row (artefato: cenas 01/04/06).
 * The server derives them from the published pieces with the catalogue owner
 * (`contentPieceCatalogFacets`), so the vocabulary is the same and a facet with
 * no option never renders. The row is pure navigation: no local state, nothing
 * filters the sample.
 */
const HOME_FACETS = ['tipo', 'cidade', 'regiao'] as const

type ContentPieceHomeFacet = (typeof HOME_FACETS)[number]

export type ContentPieceHomeFacets = Pick<ContentPieceCatalogFacets, ContentPieceHomeFacet>

const CHIP = cn(
  'flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-1.5 rounded-full border border-(--campaign-line) bg-white px-3 py-[7px] text-xs font-extrabold text-[#171000]',
  'transition-[border-color,background-color,color] duration-150 ease-out hover:border-[rgb(24_78_146/35%)] hover:bg-[#eef4fb] hover:text-[#184e92] group-open:border-[rgb(24_78_146/35%)] group-open:bg-[#eef4fb] group-open:text-[#184e92] motion-reduce:transition-none [&::-webkit-details-marker]:hidden',
  CONTENT_PIECE_FOCUS,
)

const MENU =
  'absolute top-[calc(100%+8px)] left-0 z-20 max-h-72 w-[min(220px,calc(100vw-72px))] list-none overflow-y-auto rounded-xl border border-(--campaign-line) bg-white p-1.5 shadow-[0_16px_40px_rgb(39_25_22/16%)]'

const OPTION = cn(
  'flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-[#171000] no-underline hover:bg-[#eef4fb] hover:text-[#184e92]',
  CONTENT_PIECE_FOCUS,
)

/** The canonical href of one option — each facet maps to its own URL parameter. */
const optionHref = (facet: ContentPieceHomeFacet, value: string): string => {
  if (facet === 'tipo') {
    return buildContentPieceCatalogHref({ tipo: isContentPieceType(value) ? value : null })
  }
  if (facet === 'cidade') return buildContentPieceCatalogHref({ cidade: value })
  return buildContentPieceCatalogHref({ regiao: value })
}

export const ContentPieceHomeFilterRow = ({
  facets,
  className,
}: {
  facets: ContentPieceHomeFacets
  className?: string
}) => {
  const available = HOME_FACETS.filter((facet) => facets[facet].length > 0)
  if (available.length === 0) return null

  return (
    <div className={className}>
      <p className="mb-2 text-[11px] font-bold text-(--campaign-muted)">
        <span className="sm:hidden">Explore na Central · abre já filtrada</span>
        <span className="hidden sm:inline">Explore na Central · abre o catálogo já filtrado</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {available.map((facet, index) => (
          <details key={facet} name="content-piece-home-facet" className="group relative min-w-0">
            <summary className={CHIP}>
              <span className="truncate">{contentPieceCatalogFacetLabels[facet]}</span>
              <ChevronDown
                aria-hidden="true"
                strokeWidth={2.5}
                className="size-3.5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <ul
              className={cn(
                MENU,
                // Artefato: the middle chip centers its menu, the last one
                // anchors right so no menu bleeds past the section.
                index === 1 && available.length > 2 && 'left-1/2 -translate-x-1/2',
                index > 0 && index === available.length - 1 && 'right-0 left-auto',
              )}
            >
              {facets[facet].map((option) => (
                <li key={option.value}>
                  <Link href={optionHref(facet, option.value)} className={OPTION}>
                    <span className="truncate">{option.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  )
}
