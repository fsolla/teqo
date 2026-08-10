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

export const civilDatePlusDays = (civilDate: string, days: number): string => {
  const [year, month, day] = civilDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export const weekdayOf = (civilDate: string): string => {
  const [year, month, day] = civilDate.split('-').map(Number)
  return ptBrWeekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? ''
}
