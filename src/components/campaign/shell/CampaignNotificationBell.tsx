'use client'

import {
  Activity,
  Bell,
  ClipboardList,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

import {
  openCampaignNotifications,
  type NotificationBellData,
} from '@/app/(campaign)/campanha/actions/notifications'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/Drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { CAMPAIGN_NOTIFICATION_LOAD_ERROR_MESSAGE } from '@/lib/campaignNotificationCopy'
import type { NotificationListItem } from '@/lib/notificationContract'
import { notificationTypeLabels, type NotificationType } from '@/lib/notificationContract'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'

const notificationIcons: Record<NotificationType, LucideIcon> = {
  municipality_update: ClipboardList,
  new_supporter: UserPlus,
  activity_attention: Activity,
  invite_accepted: UserRoundCheck,
}

type CampaignNotificationBellProps = NotificationBellData

/**
 * The notification bell (C108): opening the panel loads the list AND marks
 * everything as read in one server call — the open gesture is the read
 * gesture, so the badge zeroes without a separate button. Desktop renders a
 * centered Dialog (X + click-outside close), mobile a bottom sheet.
 */
export const CampaignNotificationBell = ({
  unreadCount: initialUnreadCount,
  vapidPublicKey: _vapidPublicKey,
}: CampaignNotificationBellProps) => {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount)
  const [items, setItems] = useState<NotificationListItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  const nowMs = Date.now()

  // Prop sync during render (no effect): the badge is local state once the
  // panel is open — opening marks everything as read — so a refresh racing the
  // open must not resurrect the count. The old `useEffect` mirror could re-apply
  // a stale prop over the local `setUnreadCount(0)`.
  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount)
    if (!open) setUnreadCount(initialUnreadCount)
  }

  const loadPanel = useCallback(() => {
    startTransition(async () => {
      setLoadError(null)
      const result = await openCampaignNotifications()
      if ('status' in result && result.status === 'success') {
        setItems(result.items)
        setUnreadCount(0)
        if (result.markedCount > 0) {
          // Re-sync the sibling bell instance rendered by the other header.
          // (A cross-tab mark racing between this render and the open action
          // yields markedCount 0 and a stale sibling badge until the next
          // navigation — narrow, self-healing, not worth a refresh per open.)
          router.refresh()
        }
      } else {
        setLoadError(result.message ?? CAMPAIGN_NOTIFICATION_LOAD_ERROR_MESSAGE)
      }
    })
  }, [router])

  useEffect(() => {
    if (!open) return
    loadPanel()
  }, [open, loadPanel])

  const unreadLabel =
    unreadCount === 0
      ? 'Notificações'
      : unreadCount === 1
        ? '1 notificação não lida'
        : `${unreadCount} notificações não lidas`

  const panelItems = (
    <>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {isPending && items.length === 0 ? (
        <>
          <div className="flex gap-3 rounded-lg border p-3" aria-hidden>
            <span className="mt-0.5 size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-4 w-3/4 animate-pulse rounded bg-muted" />
              <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
            </span>
          </div>
          <div className="flex gap-3 rounded-lg border p-3" aria-hidden>
            <span className="mt-0.5 size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-4 w-3/4 animate-pulse rounded bg-muted" />
              <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
            </span>
          </div>
        </>
      ) : null}

      {!loadError && items.length === 0 && !isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma notificação por aqui.
        </p>
      ) : null}

      {items.map((item) => {
        const Icon = notificationIcons[item.type]

        return (
          <Link
            key={item.id}
            href={item.payload.href}
            onClick={() => setOpen(false)}
            className="flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug">{item.payload.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.payload.detail}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{notificationTypeLabels[item.type]}</span>
                <span aria-hidden>·</span>
                <time dateTime={item.createdAt}>
                  {formatRelativeAge(new Date(item.createdAt).getTime(), nowMs)}
                </time>
              </span>
            </span>
          </Link>
        )
      })}
    </>
  )

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-11 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground md:text-foreground md:hover:bg-muted"
        aria-label={unreadLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerTitle className="sr-only">Notificações</DrawerTitle>
            <DrawerDescription className="sr-only">Avisos da campanha para você</DrawerDescription>
            <div
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              aria-busy={isPending}
            >
              {panelItems}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto p-4 sm:p-6">
            <DialogTitle className="sr-only">Notificações</DialogTitle>
            <DialogDescription className="sr-only">Avisos da campanha para você</DialogDescription>
            <div className="flex flex-col gap-2" aria-busy={isPending}>
              {panelItems}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
