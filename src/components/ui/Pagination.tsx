import * as React from 'react'

import { cn } from '@/lib/utils'
import { MoreHorizontalIcon } from 'lucide-react'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="Paginação"
    data-slot="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)

const PaginationContent = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul
    data-slot="pagination-content"
    // `m-0 list-none`: the frontend prose base styles every `ul` with disc
    // markers and margins, which leaked dots onto the campaign pagination.
    className={cn('m-0 flex list-none items-center gap-0.5', className)}
    {...props}
  />
)

const PaginationItem = ({ ...props }: React.ComponentProps<'li'>) => (
  <li data-slot="pagination-item" {...props} />
)

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    data-slot="pagination-ellipsis"
    className={cn(
      "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  >
    <MoreHorizontalIcon />
    <span className="sr-only">Mais páginas</span>
  </span>
)

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem }
