'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type MouseEvent } from 'react'

import { useCampaignListPending } from '@/components/campaign/CampaignListPending'
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
  const router = useRouter()
  const shared = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  const isPending = shared?.isPending ?? isLocalPending
  const startTransition = shared?.startTransition ?? startLocalTransition

  if (totalPages <= 1) return null

  const visiblePages = getPaginationPages(page, totalPages)

  /** Plain left-clicks navigate in a transition (pending UI); modified clicks keep link semantics. */
  const interceptNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div
      className="transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending || undefined}
      aria-busy={isPending}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Carregando página…' : ''}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={hrefForPage(Math.max(1, page - 1))}
              onClick={(event) => interceptNavigation(event, hrefForPage(Math.max(1, page - 1)))}
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
                  onClick={(event) => interceptNavigation(event, hrefForPage(pageNumber))}
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
              onClick={(event) =>
                interceptNavigation(event, hrefForPage(Math.min(totalPages, page + 1)))
              }
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
