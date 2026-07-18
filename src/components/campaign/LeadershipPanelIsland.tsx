'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { XIcon } from 'lucide-react'

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { nucleusDetailFocusFallbackId } from '@/utilities/leadershipUi'

export const getLeadershipPanelKind = (isMobile: boolean) => (isMobile ? 'drawer' : 'sheet')

export const LeadershipPanelIsland = ({
  children,
  closeHref,
  description,
  focusTargetId,
  title,
}: {
  children: ReactNode
  closeHref: string
  description: string
  focusTargetId?: string
  title: string
}) => {
  const router = useRouter()
  const panelKind = getLeadershipPanelKind(useIsMobile())
  const [open, setOpen] = useState(true)
  const [, startTransition] = useTransition()
  const closeCompleted = useRef(false)

  const handleOpenChange = (open: boolean) => {
    if (open) return
    setOpen(false)
  }

  const restoreFocusAndNavigate = () => {
    if (closeCompleted.current) return
    closeCompleted.current = true

    const focusTarget =
      (focusTargetId ? document.getElementById(focusTargetId) : null) ??
      document.getElementById(nucleusDetailFocusFallbackId)
    focusTarget?.focus()
    startTransition(() => router.push(closeHref, { scroll: false }))
  }

  if (panelKind === 'drawer') {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent className="max-h-[90vh]" finalFocus={restoreFocusAndNavigate}>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                className="absolute top-2.5 right-2.5 z-10 size-11"
                size="icon-lg"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Fechar</span>
          </DrawerClose>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocusAndNavigate()
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
