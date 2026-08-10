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
  formatBahiaCivilDateTimeLabel,
  hourOptions,
  minuteOptionsForStep,
  parseBahiaDateTimeInput,
} from '@/lib/campaignTime'
import { cn } from '@/lib/utils'

/**
 * C97 — shadcn day + time picker for the agenda quick create. The value
 * contract is the civil `YYYY-MM-DDTHH:mm` string the old `datetime-local`
 * used, so parse/validation on submit is untouched. 24h by construction:
 * the trigger formats the civil string directly and the selects list
 * 00–23 / 00–45, so no browser locale or Intl hour cycle can inject AM/PM.
 * The parent renders the surrounding Field/FieldError; this component is the
 * control itself (trigger + popover with calendar and step selects).
 *
 * C103 — on narrow viewports the picker opens as a nested bottom sheet
 * (calendar + hour/minute fully on screen, "Pronto" applies and closes),
 * keeping the desktop popover untouched.
 *
 * C104 — `timeVisible={false}` is the all-day mode: the trigger formats only
 * the date and the picker renders just the calendar (no time selects).
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
  /** Renders the picker as a nested bottom sheet instead of a popover. */
  isNarrow?: boolean
  /** Field name used in the sheet header (e.g. "Início"). */
  label?: string
  /** Marks the required fields with a visible asterisk on the narrow trigger. */
  required?: boolean
  /** When false, hide the time selects and label the trigger with the date only. */
  timeVisible?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const civil = floorToMinuteStep(value)
  const datePart = civil.slice(0, 10)
  const timePart = civil.slice(11)
  const hour = timePart.slice(0, 2)
  const minute = timePart.slice(3, 5)

  const setDate = (date: Date | undefined) => {
    if (!date) return
    onValueChange(`${formatBahiaCivilDate(date)}T${timePart}`)
  }

  const setHour = (next: string) => onValueChange(`${datePart}T${next}:${minute}`)
  const setMinute = (next: string) => onValueChange(`${datePart}T${hour}:${next}`)

  const selectedInstant = parseBahiaDateTimeInput(`${datePart}T12:00`)

  const trigger = (
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
        {timeVisible ? formatBahiaCivilDateTimeLabel(civil) : formatBahiaCivilDateLabel(civil)}
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

  const pickerContent = (
    <>
      {selectedInstant ? (
        <Calendar
          mode="single"
          locale={ptBR}
          timeZone="America/Bahia"
          selected={new Date(selectedInstant)}
          onSelect={setDate}
          className="w-full p-2"
        />
      ) : null}
      {timeVisible ? (
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground select-none">Hora</span>
              <NativeSelect
                aria-label="Hora"
                value={hour}
                onChange={(event) => setHour(event.target.value)}
              >
                {hourOptions.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}h
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground select-none">Minuto</span>
              <NativeSelect
                aria-label="Minuto"
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
              >
                {minuteOptionsForStep().map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  if (isNarrow) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {label ? `${label} — ` : ''}
                {selectedInstant ? formatBahiaCivilDate(new Date(selectedInstant)) : datePart}
              </DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {pickerContent}
            </div>
            <DrawerFooter className="border-t">
              <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(false)}>
                Pronto
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[22rem] w-80 overflow-y-auto p-0 overscroll-contain"
      >
        {pickerContent}
      </PopoverContent>
    </Popover>
  )
}
