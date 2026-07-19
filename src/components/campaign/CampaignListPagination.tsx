import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/Pagination'

export const getPaginationPages = (page: number, totalPages: number): number[] => {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  return [...pages]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b)
}

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
          <PaginationPrevious
            href={hrefForPage(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
        {visiblePages.map((pageNumber, index) => {
          const previousPage = visiblePages[index - 1]
          const hasGap = previousPage !== undefined && pageNumber - previousPage > 1

          return (
            <PaginationItem key={pageNumber} className="contents">
              {hasGap ? <PaginationEllipsis /> : null}
              <PaginationLink
                href={hrefForPage(pageNumber)}
                isActive={pageNumber === page}
                aria-label={`Ir para a página ${pageNumber}`}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          )
        })}
        <PaginationItem>
          <PaginationNext
            href={hrefForPage(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
