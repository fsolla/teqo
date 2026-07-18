import { getNucleusPaginationPages } from '@/components/campaign/NucleusPagination'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/Pagination'
import { buildActionPlanListHref, type ActionPlanListState } from '@/utilities/actionPlanUi'

export const ActionPlanPagination = ({
  state,
  totalPages,
}: {
  state: ActionPlanListState
  totalPages: number
}) => {
  if (totalPages <= 1) return null

  const visiblePages = getNucleusPaginationPages(state.page, totalPages)

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildActionPlanListHref(state, Math.max(1, state.page - 1))}
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
                href={buildActionPlanListHref(state, page)}
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
            href={buildActionPlanListHref(state, Math.min(totalPages, state.page + 1))}
            aria-disabled={state.page >= totalPages}
            className={state.page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
