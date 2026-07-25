import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/Pagination'
import { cn } from '@/lib/utils'

export const getPaginationPages = (page: number, totalPages: number): number[] => {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  return [...pages]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b)
}

/**
 * Server component: `hrefForPage` never crosses the client boundary. The
 * anchors themselves are `CampaignTransitionAnchor` client leaves so page
 * changes ride the shared list transition (results dim) instead of a dead
 * full-page load.
 */
export const CampaignListPagination = ({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
}) => {
  if (totalPages <= 1) return null

  const visiblePages = getPaginationPages(page, totalPages)

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Button
            asChild
            variant="ghost"
            size="default"
            className={cn(
              'min-h-11 min-w-11 pl-1.5!',
              page <= 1 ? 'pointer-events-none opacity-50' : undefined,
            )}
          >
            <CampaignTransitionAnchor
              href={hrefForPage(Math.max(1, page - 1))}
              aria-label="Ir para a página anterior"
              aria-disabled={page <= 1}
              data-slot="pagination-link"
            >
              <ChevronLeftIcon data-icon="inline-start" />
              <span className="hidden sm:block">Anterior</span>
            </CampaignTransitionAnchor>
          </Button>
        </PaginationItem>
        {visiblePages.map((pageNumber, index) => {
          const previousPage = visiblePages[index - 1]
          const hasGap = previousPage !== undefined && pageNumber - previousPage > 1
          const isActive = pageNumber === page

          return (
            <PaginationItem key={pageNumber} className="contents">
              {hasGap ? <PaginationEllipsis /> : null}
              <Button
                asChild
                variant={isActive ? 'outline' : 'ghost'}
                size="icon"
                className="min-h-11 min-w-11"
              >
                <CampaignTransitionAnchor
                  href={hrefForPage(pageNumber)}
                  aria-label={`Ir para a página ${pageNumber}`}
                  aria-current={isActive ? 'page' : undefined}
                  data-slot="pagination-link"
                  data-active={isActive}
                >
                  {pageNumber}
                </CampaignTransitionAnchor>
              </Button>
            </PaginationItem>
          )
        })}
        <PaginationItem>
          <Button
            asChild
            variant="ghost"
            size="default"
            className={cn(
              'min-h-11 min-w-11 pr-1.5!',
              page >= totalPages ? 'pointer-events-none opacity-50' : undefined,
            )}
          >
            <CampaignTransitionAnchor
              href={hrefForPage(Math.min(totalPages, page + 1))}
              aria-label="Ir para a próxima página"
              aria-disabled={page >= totalPages}
              data-slot="pagination-link"
            >
              <span className="hidden sm:block">Próxima</span>
              <ChevronRightIcon data-icon="inline-end" />
            </CampaignTransitionAnchor>
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
