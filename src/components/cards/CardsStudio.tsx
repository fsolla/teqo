'use client'

import { useState } from 'react'

import { CardComposer } from '@/components/cards/CardComposer'
import { CardModelGallery } from '@/components/cards/CardModelGallery'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/Drawer'
import { useIsMobileMeasured } from '@/hooks/use-mobile'
import { getCardModel, type CardModelId } from '@/lib/cardModels'

/**
 * S13 — the `/cards` studio island: owns which model is selected and whether
 * the composer is open, renders the catalog and mounts the single editor in a
 * centered dialog (desktop) or a bottom drawer (mobile). Closing returns to the
 * catalog with the selection kept; the URL is only read, never rewritten.
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

  return (
    <div>
      <CardModelGallery
        variant="select"
        ariaLabel="Modelos de card"
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
              className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-lg"
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
