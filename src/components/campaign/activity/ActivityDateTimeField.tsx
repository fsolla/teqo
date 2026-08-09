'use client'

import { CalendarIcon } from 'lucide-react'
import { ptBR } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/Calendar'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  floorToMinuteStep,
  formatBahiaCivilDate,
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
 */
export const ActivityDateTimeField = ({
  id,
  value,
  onValueChange,
  invalid = false,
  errorId,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
  /** FieldError id to announce on focus — parity with the input it replaces. */
  errorId?: string
}) => {
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          aria-describedby={errorId}
          className={cn(
            'min-h-11 w-full justify-between rounded-full border-(--field-border) bg-(--field-background) px-4 text-base text-(--field-foreground) hover:bg-(--field-background) hover:text-(--field-foreground) data-[state=open]:border-primary focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 md:text-sm',
            invalid &&
              'border-destructive ring-3 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20',
          )}
        >
          <span className="truncate">{formatBahiaCivilDateTimeLabel(civil)}</span>
          <CalendarIcon
            data-icon="inline-end"
            aria-hidden="true"
            className="size-4 text-(--field-icon)"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[22rem] w-80 overflow-y-auto p-0 overscroll-contain"
      >
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
      </PopoverContent>
    </Popover>
  )
}
