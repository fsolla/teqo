'use client'

import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useInView } from 'react-intersection-observer'

import { CampaignCellTooltip } from '@/components/campaign/shared/CampaignCellTooltip'
import { CampaignListResults } from '@/components/campaign/shared/CampaignListPending'
import {
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  resolveVisibleColumns,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import {
  CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
  type CampaignListNextPageResult,
} from '@/lib/campaignListPage'
import { cn } from '@/lib/utils'

/** The shell scroller every campaign page scrolls in — never `window`. */
const CAMPAIGN_CONTENT_SCROLL_SELECTOR = '[data-slot="campaign-content-scroll"]'
/** Set on the root from the measured sticky controls bar; the thead pins right below it. */
const CONTROLS_HEIGHT_VAR = '--campaign-list-controls-height'
const ESTIMATED_ROW_HEIGHT = 60
const FETCH_AHEAD_MARGIN = '0px 0px 600px 0px'
/**
 * The sticky controls bar paints over the scroller's own padding (rows would
 * scroll through the padding gutter above a bar pinned at the content box).
 * Its bottom padding closes the gap between bar and pinned header.
 */
const CONTROLS_BOTTOM_PADDING = 12

type FetchState = { status: 'idle' } | { status: 'fetching' } | { status: 'error'; message: string }

type CampaignInfiniteTableProps<Row> = {
  columns: Array<CampaignTableColumn<Row>>
  columnVisibility?: CampaignColumnVisibility
  /** Page 1, server-rendered. Later pages arrive through `fetchNextPage`. */
  rows: readonly Row[]
  rowKey: (row: Row) => string | number
  rowId?: (row: Row) => string | undefined
  empty?: ReactNode
  caption?: ReactNode
  /** Outer frame of the table area (border/rounding live here). */
  className?: string
  /** Table frame extras (e.g. responsive visibility: hidden below a container width). */
  tableClassName?: string
  /** Extra `<thead>` classes, merged after the built-in sticky header set. */
  headerClassName?: string
  rowClassName?: string | ((row: Row) => string | undefined)
  /** Rendered above the table, inside the results region — receives the
   * accumulated rows (e.g. mobile cards render the same continuous list). */
  resultsHeader?: (loadedRows: readonly Row[]) => ReactNode
  /**
   * B161 — named container-query attribute for the root (pinned by tests,
   * e.g. `data-container="municipality-list"`).
   */
  dataContainer?: string
  /** The filter omnibox slot; stays pinned at the top of the page scroller. */
  controls?: ReactNode
  totalDocs: number
  pageSize: number
  /**
   * Canonical filter/sort query (no page). Changing it discards accumulated
   * pages and scrolls back to the top — filters always restart the sweep.
   */
  query: string
  fetchNextPage: (page: number) => Promise<CampaignListNextPageResult<Row>>
}

const useIsPrinting = () => {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('print')
    const onChange = () => setPrinting(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return printing
}

const SKELETON_WIDTHS = ['max-w-44', 'max-w-28', 'max-w-36']

/**
 * B161 — the continuous campaign table list. One shared primitive for the
 * five table lists: sticky filter controls + sticky column header, rows that
 * keep loading as the reader approaches the end (optimistic skeletons, no
 * "carregando…" text), virtualized so only visible rows exist in the DOM.
 *
 * The page scroller (`CampaignContentScroll`) is the only scroll surface: the
 * virtualizer and the intersection sentinel both attach to it, and the table
 * frame deliberately is NOT a scroll container (`overflow-x-clip` creates
 * none), which is what lets the sticky header resolve against it.
 *
 * The server stays the authority on rows: page 1 arrives as RSC props, later
 * pages come from the list's own server action with the session's user — so
 * role scoping applies to the incremental load exactly as it does to page 1.
 */
export const CampaignInfiniteTable = <Row,>({
  columns,
  columnVisibility,
  rows,
  rowKey,
  rowId,
  empty,
  caption,
  className,
  headerClassName,
  rowClassName,
  resultsHeader,
  dataContainer,
  tableClassName,
  controls,
  totalDocs,
  pageSize,
  query,
  fetchNextPage,
}: CampaignInfiniteTableProps<Row>) => {
  const visibleColumns = resolveVisibleColumns(columns, columnVisibility?.hiddenColumnIds)

  const rootRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const controlsInnerRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const isPrinting = useIsPrinting()

  const [appended, setAppended] = useState<{
    query: string
    pages: ReadonlyArray<readonly Row[]>
    hasMore: boolean
    total: number
  }>({ query, pages: [], hasMore: totalDocs > rows.length, total: totalDocs })
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  /** Invalidates in-flight fetches when the filter/sort signature changes. */
  const fetchGenerationRef = useRef(0)
  const appendedPagesRef = useRef(appended.pages)
  appendedPagesRef.current = appended.pages
  const hasMore = appended.hasMore

  // Render-phase reset (React's "adjust state during render" pattern): when
  // the canonical query changes, the accumulated pages belong to the PREVIOUS
  // sweep — discarding them here (before commit) instead of in an effect
  // removes the frame where page 1 of the new query mixes with stale pages,
  // and re-arms `hasMore` in the same pass. Same-query refreshes only refresh
  // the total while nothing was appended (once pages exist the server's
  // `hasMore` answers, so a save that shrinks the filter can't re-arm us).
  if (appended.query !== query) {
    fetchGenerationRef.current += 1
    setAppended({ query, pages: [], hasMore: totalDocs > rows.length, total: totalDocs })
    setFetchState({ status: 'idle' })
  } else if (appended.pages.length === 0 && appended.total !== totalDocs) {
    setAppended({ ...appended, total: totalDocs, hasMore: totalDocs > rows.length })
  }

  const loadedRows = useMemo(() => {
    if (!appended.pages.length) return rows
    // A same-query `router.refresh()` can shift page 1 (an edit removed a row
    // from the filter); dedupe appended rows against the fresh seed so ids
    // never double up in the virtualizer.
    const seedKeys = new Set(rows.map(rowKey))
    const extra = appended.pages.flat().filter((row) => !seedKeys.has(rowKey(row)))
    return [...rows, ...extra]
  }, [rows, appended.pages, rowKey])

  useEffect(() => {
    setScrollElement(rootRef.current?.closest(CAMPAIGN_CONTENT_SCROLL_SELECTOR) ?? null)
  }, [])

  // The omnibox grows with chips: measure the sticky bar so the thead pins
  // exactly below it through a CSS variable (no hardcoded offset).
  useEffect(() => {
    const controlsElement = controlsRef.current
    const innerElement = controlsInnerRef.current
    const rootElement = rootRef.current
    if (!controlsElement || !innerElement || !rootElement) return
    const apply = () =>
      rootElement.style.setProperty(
        CONTROLS_HEIGHT_VAR,
        `${innerElement.offsetHeight + CONTROLS_BOTTOM_PADDING}px`,
      )
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(innerElement)
    return () => observer.disconnect()
  }, [])

  // Filter/sort changed: the sweep restarts from the top (side effect only —
  // the state discard happens in the render phase above). First mount never
  // jumps.
  const previousQueryRef = useRef(query)
  useEffect(() => {
    if (previousQueryRef.current === query) return
    previousQueryRef.current = query
    scrollElement?.scrollTo({ top: 0 })
  }, [query, scrollElement])

  const loadNextPage = useCallback(async () => {
    const generation = ++fetchGenerationRef.current
    const nextPage = appendedPagesRef.current.length + 2
    setFetchState({ status: 'fetching' })

    let result: CampaignListNextPageResult<Row>
    try {
      result = await fetchNextPage(nextPage)
    } catch {
      result = { status: 'error', message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE }
    }
    if (fetchGenerationRef.current !== generation) return

    if (result.status === 'error') {
      setFetchState({ status: 'error', message: result.message })
      return
    }

    setAppended((current) => ({
      ...current,
      pages: [...current.pages, result.rows],
      total: result.totalDocs,
      hasMore: result.hasMore,
    }))
    setFetchState({ status: 'idle' })
  }, [fetchNextPage])

  const { ref: sentinelRef, inView } = useInView({
    root: scrollElement,
    rootMargin: FETCH_AHEAD_MARGIN,
  })

  useEffect(() => {
    if (inView && hasMore && fetchState.status === 'idle') void loadNextPage()
  }, [inView, hasMore, fetchState.status, loadNextPage])

  const skeletonCount =
    fetchState.status === 'fetching'
      ? Math.min(pageSize, Math.max(0, appended.total - loadedRows.length))
      : 0
  const itemCount = loadedRows.length + skeletonCount

  const virtualizer = useVirtualizer({
    count: itemCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getScrollElement: () => scrollElement,
    overscan: 8,
    getItemKey: (index) => {
      const row = loadedRows[index]
      return row ? rowKey(row) : `skeleton-${index}`
    },
  })

  const virtualItems = virtualizer.getVirtualItems()
  const firstItem = virtualItems[0]
  const lastItem = virtualItems[virtualItems.length - 1]
  const topSpacerHeight = firstItem ? firstItem.start : 0
  const bottomSpacerHeight = lastItem ? virtualizer.getTotalSize() - lastItem.end : 0
  // Virtualization needs the page scroller and breaks on paper: fall back to
  // rendering every loaded row for print (E16) and when the scroller is absent.
  const renderAllRows = isPrinting || !scrollElement

  const renderRow = (row: Row, item?: VirtualItem) => (
    <TableRow
      key={item?.key ?? rowKey(row)}
      id={rowId?.(row)}
      data-index={item?.index}
      ref={item ? virtualizer.measureElement : undefined}
      className={typeof rowClassName === 'function' ? rowClassName(row) : rowClassName}
    >
      {visibleColumns.map((column) => {
        const cell = column.cell(row)
        const tooltip = column.cellTooltip?.(row)

        return (
          <TableCell
            key={column.id}
            className={cn(
              column.responsiveClassName,
              typeof column.cellClassName === 'function'
                ? column.cellClassName(row)
                : column.cellClassName,
            )}
          >
            {tooltip ? <CampaignCellTooltip content={tooltip}>{cell}</CampaignCellTooltip> : cell}
          </TableCell>
        )
      })}
    </TableRow>
  )

  const spacerRow = (height: number, key: string) =>
    height > 0 ? (
      <tr key={key} aria-hidden="true">
        <td
          colSpan={visibleColumns.length}
          style={{ height, padding: 0, border: 0, lineHeight: 0 }}
        />
      </tr>
    ) : null

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      {controls ? (
        <div
          ref={controlsRef}
          className="sticky -top-4 md:-top-6 z-30 -mx-4 -mt-4 bg-background px-4 pt-4 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6"
        >
          <div ref={controlsInnerRef}>{controls}</div>
        </div>
      ) : null}

      {/* The full-bleed sticky bar lives OUTSIDE the measured container: its
          negative-margin bleed must not count as horizontal overflow for the
          container-query surface (B158 pin). */}
      <div data-container={dataContainer} className={className}>
        <CampaignListResults>
          {resultsHeader ? resultsHeader(loadedRows) : null}
          <div
            className={cn(
              'overflow-x-clip overflow-y-visible rounded-xl border bg-background',
              tableClassName,
            )}
            aria-busy={fetchState.status === 'fetching'}
          >
            <Table
              containerClassName="overflow-visible"
              aria-rowcount={itemCount}
              aria-colcount={visibleColumns.length}
            >
              {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
              <TableHeader
                className={cn(
                  '[&_th]:sticky [&_th]:top-[var(--campaign-list-controls-height,0px)] [&_th]:z-10 [&_th]:bg-background',
                  '[&_th]:shadow-[inset_0_-1px_0_var(--border)]',
                  '[&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl',
                  '[&_tr]:border-b-0',
                  headerClassName,
                )}
              >
                <TableRow>
                  {visibleColumns.map((column) => (
                    <Fragment key={column.id}>
                      {column.head ?? (
                        <CampaignTableHead className={column.responsiveClassName}>
                          {column.label}
                        </CampaignTableHead>
                      )}
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadedRows.length === 0 && empty ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={visibleColumns.length} className="whitespace-normal">
                      {empty}
                    </TableCell>
                  </TableRow>
                ) : null}
                {renderAllRows
                  ? loadedRows.map((row) => renderRow(row))
                  : spacerRow(topSpacerHeight, 'campaign-infinite-table-spacer-top')}
                {!renderAllRows &&
                  virtualItems.map((item) => {
                    const row = loadedRows[item.index]
                    if (!row) {
                      return (
                        <tr
                          key={item.key}
                          data-index={item.index}
                          ref={virtualizer.measureElement}
                          aria-hidden="true"
                          className="border-b"
                        >
                          <td colSpan={visibleColumns.length} className="p-2">
                            <div className="flex items-center gap-6">
                              {visibleColumns.map((column, columnIndex) => (
                                <Skeleton
                                  key={column.id}
                                  className={cn(
                                    'h-4',
                                    column.responsiveClassName,
                                    SKELETON_WIDTHS[
                                      (item.index + columnIndex) % SKELETON_WIDTHS.length
                                    ],
                                  )}
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return renderRow(row, item)
                  })}
                {!renderAllRows &&
                  spacerRow(bottomSpacerHeight, 'campaign-infinite-table-spacer-bottom')}
              </TableBody>
            </Table>
          </div>

          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
          {/* Live region stays mounted so assistive tech observes the change
              (CampaignListResults pattern). */}
          <p className="sr-only" aria-live="polite">
            {fetchState.status === 'fetching'
              ? 'Carregando mais resultados…'
              : fetchState.status === 'error'
                ? fetchState.message
                : ''}
          </p>
          {fetchState.status === 'error' ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground"
            >
              <span>{fetchState.message}</span>
              <Button type="button" variant="ghost" className="min-h-11" onClick={loadNextPage}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </CampaignListResults>
      </div>
    </div>
  )
}
