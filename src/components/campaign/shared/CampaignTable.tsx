import { Fragment, type ReactNode } from 'react'

import { CampaignCellTooltip } from '@/components/campaign/shared/CampaignCellTooltip'
import {
  CampaignHoverTooltip,
  campaignHoverExplanationClassName,
  campaignHoverTooltipAlign,
} from '@/components/campaign/shared/CampaignHoverTooltip'
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
  /**
   * Extra reading for the cell content, shown on hover/focus/tap. Return
   * `null` for a row and that row gets no wrapper at all — a column whose
   * detail only exists on some rows (a trend with no justification) stays
   * exactly as it renders today on the others.
   *
   * Accessibility contract: the tooltip is a REDUNDANT affordance, never the
   * only path to the information. Only declare it on a column whose cell
   * already carries that content as text — visible, or `sr-only` when the
   * visible form is a badge/avatar. The table adds no tab stops for it.
   */
  cellTooltip?: (row: Row) => ReactNode
  cellClassName?: string | ((row: Row) => string | undefined)
  /** B17 seams — a mandatory column is not hideable; hidden-by-default starts unchecked. */
  mandatory?: boolean
  defaultVisible?: boolean
}

/**
 * Plain (non-sortable) header cell for column definitions. `description`
 * (B22) wraps the label in the same `CampaignHoverTooltip` `cellTooltip` uses
 * for cells, but — unlike `cellTooltip`, which adds no tab stop because it
 * repeats content already on the row — a header's explanation is often new
 * information, so the wrapping `<span tabIndex={0}>` is a deliberate new tab
 * stop; the `<th>` itself stays non-interactive. Without `description` the
 * render is byte-for-byte what it was before B22.
 */
export const CampaignTableHead = ({
  align = 'left',
  className,
  children,
  description,
}: {
  align?: 'left' | 'center' | 'right'
  className?: string
  children?: ReactNode
  description?: ReactNode
}) => (
  <TableHead
    className={cn(
      'text-muted-foreground',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {description ? (
      <CampaignHoverTooltip content={description} align={campaignHoverTooltipAlign(align)}>
        <span
          tabIndex={0}
          className={cn(
            campaignHoverExplanationClassName,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {children}
        </span>
      </CampaignHoverTooltip>
    ) : (
      children
    )}
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
            {columns.map((column) => {
              const cell = column.cell(row)
              const tooltip = column.cellTooltip?.(row)

              return (
                <TableCell
                  key={column.id}
                  className={
                    typeof column.cellClassName === 'function'
                      ? column.cellClassName(row)
                      : column.cellClassName
                  }
                >
                  {tooltip ? (
                    <CampaignCellTooltip content={tooltip}>{cell}</CampaignCellTooltip>
                  ) : (
                    cell
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)
