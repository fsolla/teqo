'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { ContentPieceBatchResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_CONTENT_PIECE_BATCH_HREF } from '@/lib/campaignPaths'
import {
  CONTENT_PIECE_BATCH_ERROR_MESSAGE,
  contentPieceBatchReceiptMessage,
  type ContentPieceBatchAction,
  type ContentPieceBatchOutcome,
  type ContentPieceSelectionRow,
} from '@/lib/contentPieceBatch'

/** What the receipt banner renders: success is `status`, a failure is `alert`. */
export type ContentPieceReceipt = {
  kind: 'success' | 'failure'
  message: string
}

export type ContentPieceBatchResult =
  | { ok: true; outcome: ContentPieceBatchOutcome }
  | { ok: false; message: string }

type ContentPieceSelectionValue = {
  selectionMode: boolean
  selectedCount: number
  allSelected: boolean
  isSelected: (id: number) => boolean
  pendingAction: ContentPieceBatchAction | null
  receipt: ContentPieceReceipt | null
  /** `/conteudos/<slug>` of the selected published pieces (the delete warning). */
  selectedPublishedPaths: readonly string[]
  enterSelection: () => void
  exitSelection: () => void
  toggle: (id: number) => void
  toggleAll: () => void
  dismissReceipt: () => void
  runBatch: (action: ContentPieceBatchAction) => Promise<ContentPieceBatchResult>
}

const ContentPieceSelectionContext = createContext<ContentPieceSelectionValue | null>(null)

export const useContentPieceSelection = (): ContentPieceSelectionValue => {
  const value = useContext(ContentPieceSelectionContext)
  if (!value) {
    throw new Error('useContentPieceSelection precisa de um ContentPieceSelectionProvider.')
  }
  return value
}

/**
 * C236 — the one selection state shared by the two bodies of the list (desktop
 * table + mobile cards) and by the action bar. Client-only by design: the two
 * RSC bodies and the shell stay untouched; the provider receives a serializable
 * projection of the visible page and wraps them via `children`.
 *
 * The selection is page-scoped and dies on navigation: the page keys this
 * provider by the canonical list URL, so a new page/filter remounts it. A
 * refresh of the same key (post-action, status poll) preserves the state, and
 * `runBatch` clears the ids on success so the receipt is about a finished
 * gesture. A whole-request failure keeps the selection — nothing changed.
 */
export const ContentPieceSelectionProvider = ({
  rows,
  children,
}: {
  rows: readonly ContentPieceSelectionRow[]
  children: ReactNode
}) => {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [pendingAction, setPendingAction] = useState<ContentPieceBatchAction | null>(null)
  const [receipt, setReceipt] = useState<ContentPieceReceipt | null>(null)

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows])
  const pageIdSet = useMemo(() => new Set(pageIds), [pageIds])
  // The selection never outgrows the visible page: an id that left the page
  // (the status poll can change the filtered rows under the same URL key) stops
  // counting and never reaches the batch.
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => pageIdSet.has(id)),
    [selectedIds, pageIdSet],
  )
  const selectedSet = useMemo(() => new Set(visibleSelectedIds), [visibleSelectedIds])
  const isSelected = useCallback((id: number) => selectedSet.has(id), [selectedSet])
  const selectedPublishedPaths = useMemo(
    () =>
      rows.flatMap((row) =>
        selectedSet.has(row.id) && row.status === 'publicado' && row.publicPath !== null
          ? [row.publicPath]
          : [],
      ),
    [rows, selectedSet],
  )

  const enterSelection = useCallback(() => {
    setSelectionMode(true)
    setReceipt(null)
  }, [])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
  }, [])

  const toggle = useCallback((id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((current) =>
      current.filter((id) => pageIdSet.has(id)).length === pageIds.length ? [] : [...pageIds],
    )
  }, [pageIds, pageIdSet])

  const dismissReceipt = useCallback(() => setReceipt(null), [])

  const runBatch = useCallback(
    async (action: ContentPieceBatchAction): Promise<ContentPieceBatchResult> => {
      setPendingAction(action)

      try {
        const { ok, payload } = await postCampaignJson<ContentPieceBatchResponse>(
          CAMPAIGN_CONTENT_PIECE_BATCH_HREF,
          { action, contentPieceIds: visibleSelectedIds },
        )

        if (!ok || payload.status !== 'success') {
          const message =
            payload.status === 'error' ? payload.message : CONTENT_PIECE_BATCH_ERROR_MESSAGE
          // The delete failure belongs to the confirmation dialog; the
          // reversible verbs answer in the list, right where the selection is.
          if (action !== 'apagar') setReceipt({ kind: 'failure', message })
          return { ok: false, message }
        }

        setReceipt({
          kind: payload.outcome.failures.length === 0 ? 'success' : 'failure',
          message: contentPieceBatchReceiptMessage(payload.outcome),
        })
        setSelectedIds([])
        return { ok: true, outcome: payload.outcome }
      } catch {
        if (action !== 'apagar') {
          setReceipt({ kind: 'failure', message: CONTENT_PIECE_BATCH_ERROR_MESSAGE })
        }
        return { ok: false, message: CONTENT_PIECE_BATCH_ERROR_MESSAGE }
      } finally {
        setPendingAction(null)
      }
    },
    [visibleSelectedIds],
  )

  const value = useMemo<ContentPieceSelectionValue>(
    () => ({
      selectionMode,
      selectedCount: visibleSelectedIds.length,
      allSelected: pageIds.length > 0 && visibleSelectedIds.length === pageIds.length,
      isSelected,
      pendingAction,
      receipt,
      selectedPublishedPaths,
      enterSelection,
      exitSelection,
      toggle,
      toggleAll,
      dismissReceipt,
      runBatch,
    }),
    [
      selectionMode,
      visibleSelectedIds,
      pageIds,
      isSelected,
      pendingAction,
      receipt,
      selectedPublishedPaths,
      enterSelection,
      exitSelection,
      toggle,
      toggleAll,
      dismissReceipt,
      runBatch,
    ],
  )

  return (
    <ContentPieceSelectionContext.Provider value={value}>
      {/* `contents` keeps the wrapper out of the layout; `group` + the data
          attribute are what the table column CSS reads to show/hide itself. */}
      <div className="group contents" data-selection-mode={selectionMode ? 'true' : undefined}>
        {children}
      </div>
    </ContentPieceSelectionContext.Provider>
  )
}
