'use client'

import { useEffect, useState } from 'react'

import { RefreshCwIcon } from 'lucide-react'

import type {
  GoogleCalendarListActionResult,
  GoogleCalendarSyncActionResult,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import type { GoogleCalendarPickerOption } from '@/utilities/googleCalendarSync'

type GoogleCalendarPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The calendar currently in use, marked and preselected. */
  currentCalendarId: string | null
  onListCalendars: () => Promise<GoogleCalendarListActionResult>
  onChooseCalendar: (calendarId: string) => Promise<GoogleCalendarSyncActionResult>
}

type PickerListStatus = 'loading' | 'error' | 'ready'

const TITLE = 'Calendário principal da campanha'
const DESCRIPTION = 'Criar e editar atividades espelham no calendário escolhido.'

/**
 * C150 — primary-calendar picker. The list is fetched live from the connected
 * Google account on every open (the account's calendars can change under us);
 * only candidate/coordination reach this dialog (the trigger is gated in the
 * sync dialog) and the server action re-validates both the role and the
 * calendar membership before writing.
 */
export const GoogleCalendarPickerDialog = ({
  open,
  onOpenChange,
  currentCalendarId,
  onListCalendars,
  onChooseCalendar,
}: GoogleCalendarPickerDialogProps) => {
  const isMobile = useIsMobile()
  const [status, setStatus] = useState<PickerListStatus>('loading')
  const [calendars, setCalendars] = useState<GoogleCalendarPickerOption[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [isChoosing, setIsChoosing] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')
    setListError(null)
    setChooseError(null)
    void onListCalendars().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setCalendars(result.calendars)
        setSelectedId(currentCalendarId)
        setStatus('ready')
      } else {
        setListError(result.message)
        setStatus('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, attempt, onListCalendars, currentCalendarId])

  const handleChoose = async () => {
    if (!selectedId || selectedId === currentCalendarId || isChoosing) return
    setIsChoosing(true)
    setChooseError(null)
    try {
      const result = await onChooseCalendar(selectedId)
      if (result.ok) {
        onOpenChange(false)
      } else {
        setChooseError(result.message ?? 'Não foi possível escolher o calendário.')
      }
    } finally {
      setIsChoosing(false)
    }
  }

  const listContent =
    status === 'loading' ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <RefreshCwIcon className="h-4 w-4 animate-spin" aria-hidden />
        Carregando calendários...
      </p>
    ) : status === 'error' ? (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-600">
          {listError}
        </p>
        <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          Tentar de novo
        </Button>
      </div>
    ) : calendars.length === 0 ? (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Nenhum calendário com permissão de edição nesta conta Google.
        </p>
        <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          Atualizar lista
        </Button>
      </div>
    ) : (
      <ul
        role="radiogroup"
        aria-label="Calendários da conta Google conectada"
        className="space-y-2"
      >
        {calendars.map((calendar) => {
          const isSelected = selectedId === calendar.id
          const isCurrent = currentCalendarId === calendar.id
          return (
            <li key={calendar.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedId(calendar.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    isSelected ? 'border-primary' : 'border-muted-foreground',
                  )}
                  aria-hidden
                >
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{calendar.summary}</span>
                  {calendar.primary ? (
                    <span className="block text-xs text-muted-foreground">
                      Calendário principal da conta
                    </span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <span className="shrink-0 text-xs text-muted-foreground">em uso</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    )

  const chooseErrorNotice = chooseError ? (
    <p role="alert" className="text-sm text-red-600">
      {chooseError}
    </p>
  ) : null

  const actions =
    status === 'ready' && calendars.length > 0 ? (
      <div className="flex flex-col gap-3">
        {chooseErrorNotice}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isChoosing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleChoose()}
            disabled={!selectedId || selectedId === currentCalendarId || isChoosing}
          >
            {isChoosing ? 'Escolhendo...' : 'Escolher calendário'}
          </Button>
        </div>
      </div>
    ) : null

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{TITLE}</DrawerTitle>
            <DrawerDescription>{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2">
            <div className="space-y-4">
              {listContent}
              {actions}
            </div>
          </div>
          <DrawerFooter className="border-t">
            <DrawerCloseButton className="w-full">Fechar</DrawerCloseButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <div
          data-slot="dialog-scroll-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
        >
          {listContent}
        </div>
        {actions ? (
          <div data-slot="dialog-footer" className="shrink-0 border-t px-6 py-4">
            {actions}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
