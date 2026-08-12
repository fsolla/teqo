'use client'

import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { ptBR } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/Calendar'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  floorToMinuteStep,
  formatBahiaCivilDate,
  formatBahiaCivilDateLabel,
  hourOptions,
  minuteOptionsForStep,
  parseBahiaDateTimeInput,
} from '@/lib/campaignTime'
import { cn } from '@/lib/utils'

/**
 * C97/C123 — the date+time control for the agenda overlay. C123 split it: the
 * day part is a calendar trigger (popover on desktop, nested bottom sheet on
 * mobile) and the Hora/Minuto selects render INLINE beside it, always visible
 * — nothing hides below the calendar anymore. The value contract stays the
 * civil `YYYY-MM-DDTHH:mm` string, so parse/validation on submit is untouched.
 * 24h by construction: the trigger formats the civil date directly and the
 * selects list 00–23 / 00–45, so no browser locale or Intl hour cycle can
 * inject AM/PM. The parent renders the surrounding Field/FieldError; this
 * component is the control itself.
 *
 * C104 — `timeVisible={false}` is the all-day mode: only the date trigger
 * renders, the time selects disappear.
 */
export const ActivityDateTimeField = ({
  id,
  value,
  onValueChange,
  invalid = false,
  errorId,
  isNarrow = false,
  label,
  required = false,
  timeVisible = true,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
  /** FieldError id to announce on focus — parity with the input it replaces. */
  errorId?: string
  /** Renders the calendar picker as a nested bottom sheet instead of a popover. */
  isNarrow?: boolean
  /** Field name used in the sheet header and the time-select a11y labels (e.g. "Início"). */
  label?: string
  /** Marks the required fields with a visible asterisk on the narrow trigger. */
  required?: boolean
  /** When false, hide the time selects (all-day mode). */
  timeVisible?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const civil = floorToMinuteStep(value)
  const datePart = civil.slice(0, 10)
  // A draft without a startAt (tour drafts) renders the controls empty: the
  // selects default to 00:00 and picking a date seeds the time part.
  const timePart = civil ? civil.slice(11) : '00:00'
  const hour = timePart.slice(0, 2)
  const minute = timePart.slice(3, 5)

  const setDate = (date: Date | undefined) => {
    if (!date) return
    onValueChange(`${formatBahiaCivilDate(date)}T${timePart}`)
  }

  // Time edits are a no-op until a date exists: a draft without a startAt
  // (tour drafts) must not emit a corrupt civil string like `T09:00`.
  const setHour = (next: string) => {
    if (!datePart) return
    onValueChange(`${datePart}T${next}:${minute}`)
  }
  const setMinute = (next: string) => {
    if (!datePart) return
    onValueChange(`${datePart}T${hour}:${next}`)
  }

  const selectedInstant = parseBahiaDateTimeInput(
    `${datePart || formatBahiaCivilDate(new Date())}T12:00`,
  )

  const dateTrigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-invalid={invalid}
      aria-describedby={errorId}
      aria-haspopup="dialog"
      aria-expanded={isNarrow ? open : undefined}
      onClick={isNarrow ? () => setOpen(true) : undefined}
      className={cn(
        'min-h-11 w-full justify-between rounded-full border-(--field-border) bg-(--field-background) px-4 text-base text-(--field-foreground) hover:bg-(--field-background) hover:text-(--field-foreground) data-[state=open]:border-primary focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 md:text-sm',
        isNarrow &&
          'rounded-none border-0 bg-transparent px-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/30',
        invalid &&
          'border-destructive ring-3 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20',
      )}
    >
      <span className="truncate">
        {civil ? formatBahiaCivilDateLabel(civil) : 'Selecionar data'}
      </span>
      {isNarrow && required ? (
        <span aria-hidden="true" className="font-semibold text-destructive">
          *
        </span>
      ) : null}
      <CalendarIcon
        data-icon="inline-end"
        aria-hidden="true"
        className="size-4 text-(--field-icon)"
      />
    </Button>
  )

  const calendarContent = selectedInstant ? (
    <Calendar
      mode="single"
      locale={ptBR}
      timeZone="America/Bahia"
      selected={new Date(selectedInstant)}
      onSelect={setDate}
      className="w-full p-2"
    />
  ) : null

  const timeSelects = timeVisible ? (
    <div
      className={cn('flex min-w-0 gap-1.5', isNarrow ? 'shrink-0' : 'shrink-0 sm:gap-2')}
      role="group"
      aria-label={`Horário de ${label ?? 'início'}`}
    >
      {(
        [
          ['Hora', hour, setHour],
          ['Minuto', minute, setMinute],
        ] as const
      ).map(([part, value, onChange]) => (
        <div key={part} className={cn('flex flex-col gap-1', isNarrow ? 'w-16' : 'w-20')}>
          {!isNarrow ? (
            <span className="text-xs font-medium text-muted-foreground select-none">{part}</span>
          ) : null}
          <NativeSelect
            aria-label={`${part} de ${label ?? 'início'}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              'w-full **:data-[slot=native-select]:min-h-11',
              isNarrow &&
                '**:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-none **:data-[slot=native-select]:border-0 **:data-[slot=native-select]:bg-transparent **:data-[slot=native-select]:px-1',
            )}
          >
            {(part === 'Hora' ? hourOptions : minuteOptionsForStep()).map((option) => (
              <NativeSelectOption key={option} value={option}>
                {part === 'Hora' ? `${option}h` : option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  ) : null

  return (
    <div className={cn('flex w-full items-start gap-1.5 sm:gap-2', isNarrow && 'min-h-11')}>
      <div className="min-w-0 flex-1">
        {isNarrow ? (
          <>
            {dateTrigger}
            <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>
                    {label ? `${label} — ` : ''}
                    {selectedInstant ? formatBahiaCivilDate(new Date(selectedInstant)) : datePart}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
                  {calendarContent}
                </div>
                <DrawerFooter className="border-t">
                  <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(false)}>
                    Pronto
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{dateTrigger}</PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-[22rem] w-80 overflow-y-auto p-0 overscroll-contain"
            >
              {calendarContent}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {timeSelects}
    </div>
  )
}
