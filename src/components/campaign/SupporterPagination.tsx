import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/Pagination'
import { getNucleusPaginationPages } from '@/components/campaign/NucleusPagination'
import { buildSupporterListHref, type SupporterListState } from '@/utilities/supporterUi'

export const SupporterPagination = ({
  state,
  totalPages,
}: {
  state: SupporterListState
  totalPages: number
}) => {
  if (totalPages <= 1) return null

  const visiblePages = getNucleusPaginationPages(state.page, totalPages)

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildSupporterListHref(state, Math.max(1, state.page - 1))}
            aria-disabled={state.page <= 1}
            className={state.page <= 1 ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
        {visiblePages.map((page, index) => {
          const previousPage = visiblePages[index - 1]
          const hasGap = previousPage !== undefined && page - previousPage > 1

          return (
            <PaginationItem key={page} className="contents">
              {hasGap ? <PaginationEllipsis /> : null}
              <PaginationLink
                href={buildSupporterListHref(state, page)}
                isActive={page === state.page}
                aria-label={`Ir para a página ${page}`}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        })}
        <PaginationItem>
          <PaginationNext
            href={buildSupporterListHref(state, Math.min(totalPages, state.page + 1))}
            aria-disabled={state.page >= totalPages}
            className={state.page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
