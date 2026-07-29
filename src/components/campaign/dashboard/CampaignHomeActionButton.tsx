'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCoarsePointer } from '@/lib/campaignCoarsePointer'
import { useCampaignLongPress } from '@/lib/campaignLongPress'

export type CampaignHomeActionButtonProps = {
  label: string
  icon: LucideIcon
  description?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
}

const actionControlClassName =
  'group flex min-h-11 w-[4.75rem] shrink-0 snap-start flex-col items-center gap-2 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

const ActionVisual = ({ label, icon: Icon }: { label: string; icon: LucideIcon }) => (
  <>
    <span
      aria-hidden
      className="flex size-14 items-center justify-center rounded-full bg-muted text-foreground transition-colors group-hover:bg-muted/80 group-focus-visible:bg-muted/80"
    >
      <Icon className="size-6" strokeWidth={1.75} />
    </span>
    <span className="line-clamp-2 w-full text-sm leading-snug font-medium text-foreground">
      {label}
    </span>
  </>
)

export const CampaignHomeActionButton = ({
  label,
  icon,
  description,
  href,
  onClick,
  disabled = false,
}: CampaignHomeActionButtonProps) => {
  const isCoarsePointer = useCoarsePointer()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const descriptionId = useId()
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  const openDescription = useCallback(() => {
    if (description) setDrawerOpen(true)
  }, [description])

  const fireClick = useCallback(
    (_event: MouseEvent) => {
      onClick?.()
    },
    [onClick],
  )

  const useLongPress = Boolean(description) && isCoarsePointer && !disabled
  const longPress = useCampaignLongPress({
    enabled: useLongPress,
    onLongPress: openDescription,
    onClick: href ? undefined : onClick ? fireClick : undefined,
  })

  const pointerHandlers = useLongPress ? longPress : undefined
  const className = actionControlClassName
  const aria = {
    'aria-label': label,
    'aria-describedby': drawerOpen && useLongPress ? descriptionId : undefined,
  }

  const pointerProps = pointerHandlers
    ? {
        onPointerDown: pointerHandlers.onPointerDown,
        onPointerMove: pointerHandlers.onPointerMove,
        onPointerUp: pointerHandlers.onPointerUp,
        onPointerCancel: pointerHandlers.onPointerCancel,
      }
    : undefined

  let control: ReactNode

  if (disabled) {
    control = (
      <span className={className} aria-disabled="true" {...aria}>
        <ActionVisual label={label} icon={icon} />
      </span>
    )
  } else if (href) {
    control = (
      <Link
        href={href}
        className={className}
        {...aria}
        {...pointerProps}
        onClick={pointerHandlers?.onClick}
      >
        <ActionVisual label={label} icon={icon} />
      </Link>
    )
  } else {
    control = (
      <button
        type="button"
        className={className}
        {...aria}
        {...pointerProps}
        onClick={pointerHandlers?.onClick ?? (onClick ? fireClick : undefined)}
      >
        <ActionVisual label={label} icon={icon} />
      </button>
    )
  }

  const withTooltip =
    description && !isCoarsePointer && !disabled ? (
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-left font-normal">
          {description}
        </TooltipContent>
      </Tooltip>
    ) : (
      control
    )

  return (
    <>
      {withTooltip}
      {description && isCoarsePointer && !disabled ? (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent initialFocus={titleRef}>
            <DrawerHeader>
              <DrawerTitle ref={titleRef} tabIndex={-1} className="outline-none">
                {label}
              </DrawerTitle>
              <DrawerDescription id={descriptionId}>{description}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose
                render={<Button type="button" variant="outline" className="min-h-11 w-full" />}
              >
                Fechar
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  )
}
