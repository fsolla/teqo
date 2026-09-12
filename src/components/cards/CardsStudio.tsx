'use client'

import { useState } from 'react'

import { CardComposer } from '@/components/cards/CardComposer'
import { CardModelGallery } from '@/components/cards/CardModelGallery'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/Drawer'
import { useIsMobileMeasured } from '@/hooks/use-mobile'
import { getCardModel, type CardModelId } from '@/lib/cardModels'

/**
 * S13 — the card studio island: owns which model is selected and whether the
 * composer is open, renders the catalog and mounts the single editor in a
 * centered dialog (desktop) or a bottom drawer (mobile). Closing returns to the
 * catalog with the selection kept; the URL is only read, never rewritten.
 *
 * S14 — the home section renders this same island (no second editor): tiles are
 * buttons everywhere and opening the composer never navigates.
 */
export const CardsStudio = ({
  initialModelId,
  fontFamily,
}: {
  initialModelId?: CardModelId
  fontFamily: string
}) => {
  const initialModel = initialModelId ? getCardModel(initialModelId) : undefined
  const [selectedId, setSelectedId] = useState<CardModelId | null>(initialModel?.id ?? null)
  const [open, setOpen] = useState(Boolean(initialModel))
  const { isMobile, measured } = useIsMobileMeasured()
  const selectedModel = selectedId ? getCardModel(selectedId) : undefined

  const handleSelect = (id: CardModelId) => {
    setSelectedId(id)
    setOpen(true)
  }

  // Radix restores focus to the element that opened the dialog; send it back to
  // the catalog tile of the selected model (visible list only) so home and
  // `/cards` share the same focus return.
  const focusSelectedTile = () => {
    if (!selectedId) return
    const tiles = document.querySelectorAll<HTMLElement>(`[data-card-model-tile="${selectedId}"]`)
    const visibleTile = Array.from(tiles).find((tile) => tile.getClientRects().length > 0)
    visibleTile?.focus()
  }

  return (
    <div>
      <CardModelGallery
        ariaLabel="Modelos de card"
        fontFamily={fontFamily}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {selectedModel && measured ? (
        isMobile ? (
          <Drawer open={open} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
            <DrawerContent
              data-theme="campaign-site"
              className="bg-background text-foreground [--drawer-content-max-height:92dvh]"
            >
              <CardComposer
                model={selectedModel}
                shell="drawer"
                fontFamily={fontFamily}
                onClose={() => setOpen(false)}
              />
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              data-theme="campaign-site"
              showCloseButton={false}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                focusSelectedTile()
              }}
              className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0"
            >
              <CardComposer
                model={selectedModel}
                shell="dialog"
                fontFamily={fontFamily}
                onClose={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )
      ) : null}
    </div>
  )
}
