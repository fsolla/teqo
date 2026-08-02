import { Fragment, type ReactNode } from 'react'

import { CampaignCellTooltip } from '@/components/campaign/shared/CampaignCellTooltip'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  resolveVisibleColumns,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import {
  campaignHoverExplanationClassName,
  campaignHoverTooltipAlign,
} from '@/lib/campaignHoverTooltip'
import { cn } from '@/lib/utils'

/**
 * Campaign list-table system (Pass 2 W1): columns are data, the table is a
 * server component, interactivity lives in head/cell islands referenced by the
 * definitions. B17 (column picker) toggles visibility over `id`s; E10/E14 add
 * a definition instead of a new table.
 */
export type CampaignTableColumn<Row> = {
  /** Stable identifier — the column-picker key (B17). */
  id: string
  /**
   * Short pt-BR name of the column, and the default header copy. `head` is an
   * opaque `ReactNode` (often a client island), so the picker — which only
   * receives serializable data — needs the name spelled out here.
   *
   * It normally IS the header copy, but it does not have to be: a header can
   * afford to be terse because it sits above its own data (municípios' "2022"),
   * while the same word alone in a menu of column names says nothing.
   */
  label: string
  /**
   * Full `<th>` node, defaulting to `<CampaignTableHead>{label}</CampaignTableHead>`.
   * Declare it only when the header is more than its name: an alignment, a
   * B22 `description`, or a head island of its own (`MunicipalitySortableHead`)
   * owning `aria-sort` and the filter popover.
   */
  head?: ReactNode
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
  /** B17 — a mandatory column is listed in the picker but cannot be unchecked. */
  mandatory?: boolean
}

/**
 * Plain (non-sortable) header cell for column definitions. `description`
 * (B22) wraps the label in the same `CampaignHoverTooltip` `cellTooltip` uses
 * for cells, but — unlike `cellTooltip`, which adds no tab stop because it
 * repeats content already on the row — a header's explanation is often new
 * information, so the wrapping `<span tabIndex={0}>` is a deliberate new tab
 * stop; the `<th>` itself stays non-interactive. Without `description` the
 * render is byte-for-byte what it was before B22.
 *
 * Optional `filter` mirrors `CampaignSortableHead`'s slot for filter-only
 * columns (no sort control) so domain wrappers don't re-copy the tooltip chrome.
 */
export const CampaignTableHead = ({
  align = 'left',
  className,
  children,
  description,
  filter,
}: {
  align?: 'left' | 'center' | 'right'
  className?: string
  children?: ReactNode
  description?: ReactNode
  filter?: ReactNode
}) => {
  const label = description ? (
    <CampaignHoverTooltip content={description} align={campaignHoverTooltipAlign(align)}>
      <span
        tabIndex={0}
        className={cn(
          campaignHoverExplanationClassName,
          filter && 'inline-flex min-h-11 items-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {children}
      </span>
    </CampaignHoverTooltip>
  ) : filter ? (
    <span className="inline-flex min-h-11 items-center">{children}</span>
  ) : (
    children
  )

  return (
    <TableHead
      className={cn(
        'text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {filter ? (
        <div
          className={cn(
            'flex items-center',
            align === 'right' && 'justify-end',
            align === 'center' && 'justify-center',
          )}
        >
          {label}
          {filter}
        </div>
      ) : (
        label
      )}
    </TableHead>
  )
}

type CampaignTableProps<Row> = {
  columns: Array<CampaignTableColumn<Row>>
  /**
   * B17 — hidden column ids from the cookie (`readCampaignColumnVisibility`).
   * The picker itself renders in the omnibox `trailing` (B137); this prop only
   * filters which columns the table paints.
   */
  columnVisibility?: CampaignColumnVisibility
  rows: readonly Row[]
  rowKey: (row: Row) => string | number
  /** Optional DOM id per row (e.g. hash targets on `/campanha/territorios`). */
  rowId?: (row: Row) => string | undefined
  /** Rendered inside a full-width row when there are no rows — the header chrome stays mounted. */
  empty?: ReactNode
  /** Screen-reader table description. */
  caption?: ReactNode
  /** Outer wrapper (border/rounding live here). */
  className?: string
  /** `ui/Table` scroll container class (default already includes `overflow-x-auto`). */
  containerClassName?: string
  /** `<thead>` override (e.g. sticky headers). */
  headerClassName?: string
  rowClassName?: string | ((row: Row) => string | undefined)
}

export const CampaignTable = <Row,>({
  columns,
  columnVisibility,
  rows,
  rowKey,
  rowId,
  empty,
  caption,
  className,
  containerClassName,
  headerClassName,
  rowClassName,
}: CampaignTableProps<Row>) => {
  const visibleColumns = resolveVisibleColumns(columns, columnVisibility?.hiddenColumnIds)

  return (
    <>
      <div className={cn('overflow-hidden rounded-xl border', className)}>
        <Table containerClassName={containerClassName}>
          {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
          <TableHeader className={headerClassName}>
            <TableRow>
              {visibleColumns.map((column) => (
                <Fragment key={column.id}>
                  {column.head ?? <CampaignTableHead>{column.label}</CampaignTableHead>}
                </Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && empty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length} className="whitespace-normal">
                  {empty}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                id={rowId?.(row)}
                className={typeof rowClassName === 'function' ? rowClassName(row) : rowClassName}
              >
                {visibleColumns.map((column) => {
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
    </>
  )
}
