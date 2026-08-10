import * as React from 'react'

import { cn } from '@/lib/utils'

const Table = ({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'table'> & {
  /** Override the scroll container (default already includes `overflow-x-auto`).
   *  Sticky-left columns keep that default. A sticky header must resolve
   *  against the page scroller instead of this box, which requires the box NOT
   *  to be a scroll container at all — use `overflow-x-clip` (clip pairs with
   *  `overflow-y: visible` without promoting it to `auto`), as the sticky
   *  campaign lists (D7) do. Never use `overflow-x-visible` here. */
  containerClassName?: string
}) => (
  <div
    data-slot="table-container"
    className={cn('relative w-full overflow-x-auto', containerClassName)}
  >
    <table
      data-slot="table"
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
)

const TableHeader = ({ className, ...props }: React.ComponentProps<'thead'>) => (
  <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
)

const TableBody = ({ className, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody
    data-slot="table-body"
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
)

const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>) => (
  <tr
    data-slot="table-row"
    className={cn(
      'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
)

const TableHead = ({ className, ...props }: React.ComponentProps<'th'>) => (
  <th
    data-slot="table-head"
    className={cn(
      'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
)

const TableCell = ({ className, ...props }: React.ComponentProps<'td'>) => (
  <td
    data-slot="table-cell"
    className={cn('p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
)

const TableCaption = ({ className, ...props }: React.ComponentProps<'caption'>) => (
  <caption
    data-slot="table-caption"
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
)

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow }
