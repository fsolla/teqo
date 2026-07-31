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
  listCampaignNotifications,
  markAllCampaignNotificationsRead,
  type NotificationBellData,
} from '@/app/(campaign)/campanha/actions/notifications'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import type { NotificationListItem } from '@/lib/notificationContract'
import { notificationTypeLabels, type NotificationType } from '@/lib/notificationContract'
import { cn } from '@/lib/utils'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'

const notificationIcons: Record<NotificationType, LucideIcon> = {
  municipality_update: ClipboardList,
  new_supporter: UserPlus,
  activity_attention: Activity,
  invite_accepted: UserRoundCheck,
}

type CampaignNotificationBellProps = NotificationBellData

export const CampaignNotificationBell = ({
  unreadCount: initialUnreadCount,
  vapidPublicKey: _vapidPublicKey,
}: CampaignNotificationBellProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [items, setItems] = useState<NotificationListItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  const nowMs = Date.now()

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const loadItems = useCallback(() => {
    startTransition(async () => {
      setLoadError(null)
      try {
        const nextItems = await listCampaignNotifications()
        setItems(nextItems)
        setUnreadCount(nextItems.filter((item) => !item.readAt).length)
      } catch {
        setLoadError('Não foi possível carregar as notificações.')
      }
    })
  }, [])

  useEffect(() => {
    if (!open) return
    loadItems()
  }, [open, loadItems])

  const handleMarkAllRead = () => {
    startTransition(async () => {
      const result = await markAllCampaignNotificationsRead()
      if ('status' in result && result.status === 'success') {
        setItems((current) =>
          current.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
        )
        setUnreadCount(0)
        router.refresh()
      }
    })
  }

  const unreadLabel =
    unreadCount === 0
      ? 'Notificações'
      : unreadCount === 1
        ? '1 notificação não lida'
        : `${unreadCount} notificações não lidas`

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

      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Notificações</DrawerTitle>
            <DrawerDescription>
              {unreadCount > 0
                ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`
                : 'Tudo em dia'}
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2"
            aria-busy={isPending}
          >
            {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

            {!loadError && items.length === 0 && !isPending ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            ) : null}

            {items.map((item) => {
              const Icon = notificationIcons[item.type]
              const isUnread = !item.readAt

              return (
                <Link
                  key={item.id}
                  href={item.payload.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                    isUnread && 'border-primary/30 bg-primary/5',
                  )}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">
                      {item.payload.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.payload.detail}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{notificationTypeLabels[item.type]}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={item.createdAt}>
                        {formatRelativeAge(new Date(item.createdAt).getTime(), nowMs)}
                      </time>
                      {isUnread ? (
                        <span className="ml-auto size-2 rounded-full bg-primary" aria-hidden />
                      ) : null}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>

          <DrawerFooter className="border-t">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isPending || unreadCount === 0}
              onClick={handleMarkAllRead}
            >
              Marcar todas como lidas
            </Button>
            <DrawerCloseButton className="w-full">Fechar</DrawerCloseButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
