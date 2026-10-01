/**
 * Agenda mobile (C101) — the header period label is computed from the
 * calendar's current date, so the e2e specs derive the expected label from
 * "today" instead of hardcoding it. Shared by the agenda mobile spec and the
 * C95 view-switching spec. Production vocabulary lives in
 * `src/utilities/activityUi.ts`; these helpers only mirror the label FORMAT
 * for assertions (the unit spec pins the literal strings).
 */

export const ptBrMonthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const ptBrWeekdays = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

/** "2026-08-09" → "9 Agosto" (the mobile header period label). */
export const dayLabelFor = (civilDate: string): string =>
  `${Number(civilDate.slice(8, 10))} ${ptBrMonthNames[Number(civilDate.slice(5, 7)) - 1]}`

/**
 * "[data-day=\"DD/MM/YYYY\"]" — the Calendar day cell's stable contract
 * (`Calendar.tsx` DayButton formats the civil date with the pt-BR locale).
 * Click day cells through this selector, never through the accessible name:
 * "2 de outubro de 2026" is a substring of "12…"/"22 de outubro de 2026",
 * so name matching resolves to several cells (strict mode violation).
 */
export const calendarDaySelector = (civilDate: string): string => {
  const [year, month, day] = civilDate.split('-')
  return `[data-day="${day}/${month}/${year}"]`
}

export const civilDatePlusDays = (civilDate: string, days: number): string => {
  const [year, month, day] = civilDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export const weekdayOf = (civilDate: string): string => {
  const [year, month, day] = civilDate.split('-').map(Number)
  return ptBrWeekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? ''
}
