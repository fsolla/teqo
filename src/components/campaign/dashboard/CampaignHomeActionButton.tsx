'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCoarsePointer } from '@/lib/campaignCoarsePointer'
import { useCampaignLongPress } from '@/lib/campaignLongPress'
import { cn } from '@/lib/utils'

export type CampaignHomeActionButtonProps = {
  label: string
  icon: LucideIcon
  description?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  layout?: 'strip' | 'responsive'
}

const actionControlBaseClassName =
  'group box-content flex min-h-11 flex-col items-center gap-2 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-90 disabled:pointer-events-none disabled:opacity-50'

const actionStripControlClassName = cn(actionControlBaseClassName, 'w-[5.5rem] shrink-0 snap-start')

const actionResponsiveControlClassName = cn(
  actionControlBaseClassName,
  'w-full md:w-[5.5rem] md:shrink-0 md:snap-start',
)

const circleClassName =
  'flex size-14 items-center justify-center rounded-full bg-muted text-foreground transition-[transform,colors] duration-150 ease-out motion-reduce:transition-none pointer-fine:group-hover:scale-[1.05] pointer-coarse:group-data-[pressing=true]:scale-[1.05] motion-reduce:scale-100 group-hover:bg-muted/80 group-focus-visible:bg-muted/80'

const ActionVisual = ({ label, icon: Icon }: { label: string; icon: LucideIcon }) => (
  <>
    <span aria-hidden className={circleClassName}>
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
  layout = 'strip',
}: CampaignHomeActionButtonProps) => {
  const isCoarsePointer = useCoarsePointer()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const descriptionId = useId()
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  const openDescription = useCallback(() => {
    if (description) setDrawerOpen(true)
  }, [description])

  const longPressEnabled = Boolean(description) && isCoarsePointer && !disabled
  const isInert = !disabled && !href && !onClick
  const { pressing, ...longPressHandlers } = useCampaignLongPress({
    enabled: longPressEnabled,
    onLongPress: openDescription,
    onClick:
      href || !onClick
        ? undefined
        : (_event: MouseEvent) => {
            onClick()
          },
  })

  const className = cn(
    layout === 'responsive' ? actionResponsiveControlClassName : actionStripControlClassName,
    isInert && 'cursor-default',
  )
  const aria = {
    'aria-label': label,
    'aria-describedby': drawerOpen && longPressEnabled ? descriptionId : undefined,
  }

  const longPressProps = longPressEnabled
    ? {
        ...longPressHandlers,
        'data-pressing': pressing ? true : undefined,
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
      <Link href={href} className={className} {...aria} {...longPressProps}>
        <ActionVisual label={label} icon={icon} />
      </Link>
    )
  } else {
    control = (
      <button
        type="button"
        className={className}
        {...aria}
        {...longPressProps}
        onClick={
          longPressEnabled
            ? longPressHandlers.onClick
            : onClick
              ? () => {
                  onClick()
                }
              : undefined
        }
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
              <DrawerCloseButton>Fechar</DrawerCloseButton>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  )
}
