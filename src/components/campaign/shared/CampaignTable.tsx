import { Fragment, type ReactNode } from 'react'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { cn } from '@/lib/utils'

/**
 * Campaign list-table system (Pass 2 W1): columns are data, the table is a
 * server component, interactivity lives in head/cell islands referenced by the
 * definitions. B17 (column picker) toggles visibility over `id`s; E10/E14 add
 * a definition instead of a new table.
 */
export type CampaignTableColumn<Row> = {
  /** Stable identifier — the future column-picker key (B17). */
  id: string
  /**
   * Full `<th>` node. Plain labels use `<CampaignTableHead>`; rich columns
   * render their own head island (e.g. `MunicipalitySortableHead`), which owns
   * `aria-sort` and the filter popover.
   */
  head: ReactNode
  cell: (row: Row) => ReactNode
  cellClassName?: string | ((row: Row) => string | undefined)
  /** B17 seams — a mandatory column is not hideable; hidden-by-default starts unchecked. */
  mandatory?: boolean
  defaultVisible?: boolean
}

/** Plain (non-sortable) header cell for column definitions. */
export const CampaignTableHead = ({
  align = 'left',
  className,
  children,
}: {
  align?: 'left' | 'center' | 'right'
  className?: string
  children?: ReactNode
}) => (
  <TableHead
    className={cn(
      'text-muted-foreground',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {children}
  </TableHead>
)

type CampaignTableProps<Row> = {
  columns: Array<CampaignTableColumn<Row>>
  rows: readonly Row[]
  rowKey: (row: Row) => string | number
  /** Rendered inside a full-width row when there are no rows — the header chrome stays mounted. */
  empty?: ReactNode
  /** Screen-reader table description. */
  caption?: ReactNode
  /** Outer wrapper (border/rounding live here). */
  className?: string
  /** `ui/Table` scroll container override (e.g. municipality's `overflow-x-visible`). */
  containerClassName?: string
  /** `<thead>` override (e.g. sticky headers). */
  headerClassName?: string
  rowClassName?: string | ((row: Row) => string | undefined)
}

export const CampaignTable = <Row,>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  className,
  containerClassName,
  headerClassName,
  rowClassName,
}: CampaignTableProps<Row>) => (
  <div className={cn('overflow-hidden rounded-xl border', className)}>
    <Table containerClassName={containerClassName}>
      {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
      <TableHeader className={headerClassName}>
        <TableRow>
          {columns.map((column) => (
            <Fragment key={column.id}>{column.head}</Fragment>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && empty ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="whitespace-normal">
              {empty}
            </TableCell>
          </TableRow>
        ) : null}
        {rows.map((row) => (
          <TableRow
            key={rowKey(row)}
            className={typeof rowClassName === 'function' ? rowClassName(row) : rowClassName}
          >
            {columns.map((column) => (
              <TableCell
                key={column.id}
                className={
                  typeof column.cellClassName === 'function'
                    ? column.cellClassName(row)
                    : column.cellClassName
                }
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)
