const BAHIA_TIME_ZONE = 'America/Bahia'

type CivilDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
  timeZone: BAHIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const getZonedParts = (date: Date): CivilDateTime => {
  const parts = Object.fromEntries(
    zonedFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

const civilAsUtcMilliseconds = ({
  year,
  month,
  day,
  hour,
  minute,
  second,
}: CivilDateTime): number => Date.UTC(year, month - 1, day, hour, minute, second)

const zonedCivilToInstant = (civil: CivilDateTime): Date => {
  const desired = civilAsUtcMilliseconds(civil)
  let candidate = desired

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const observed = civilAsUtcMilliseconds(getZonedParts(new Date(candidate)))
    const correction = desired - observed
    if (correction === 0) return new Date(candidate)
    candidate += correction
  }

  throw new Error('Não foi possível calcular o intervalo semanal no fuso da Bahia.')
}

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * `aaaa-mm-dd` of an instant in Bahia civil time. Fixed width, so the result
 * is lexicographically comparable against a date anchor written the same way —
 * which is how the calendar phase (E13) decides its cut without importing a
 * date library, and why the day turns at midnight in Bahia rather than in UTC.
 */
export const formatBahiaCivilDate = (date: Date): string => {
  const { year, month, day } = getZonedParts(date)
  return `${year}-${pad(month)}-${pad(day)}`
}

const bahiaDateTimeInputPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Converts a `datetime-local` input value (interpreted as Bahia civil time,
 * since campaign staff operate in that timezone) into a UTC ISO instant.
 * Returns null when the value does not match the expected input shape.
 */
export const parseBahiaDateTimeInput = (value: string): string | null => {
  const match = bahiaDateTimeInputPattern.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match

  return zonedCivilToInstant({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  }).toISOString()
}

/** Formats a UTC ISO instant as a `datetime-local` input value in Bahia civil time. */
export const formatIsoAsBahiaDateTimeInput = (iso: string): string => {
  const { year, month, day, hour, minute } = getZonedParts(new Date(iso))

  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

const bahiaDateTimeDisplayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BAHIA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Formats a UTC ISO instant as `dd/mm/aaaa às hh:mm` in Bahia civil time. */
export const formatBahiaDateTimeLabel = (iso: string): string =>
  bahiaDateTimeDisplayFormatter.format(new Date(iso)).replace(', ', ' às ')

const bahiaDateDisplayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BAHIA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
})

/** Formats an instant as `dd/mm` in Bahia civil time — the day the staff names things by. */
export const formatBahiaDayLabel = (date: Date): string => bahiaDateDisplayFormatter.format(date)

/** UTC midnight ISO for a Bahia civil date anchor (`aaaa-mm-dd`). */
export const civilDateToUtcMidnightIso = (civilDate: string): string => `${civilDate}T00:00:00.000Z`

/** Calendar-day difference between two Bahia civil dates (`later − earlier`). */
export const civilDateDaysBetween = (earlier: string, later: string): number => {
  const [y1, m1, d1] = earlier.split('-').map(Number)
  const [y2, m2, d2] = later.split('-').map(Number)
  const msPerDay = 86_400_000
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / msPerDay)
}

/** Subtract whole civil days from a Bahia civil date anchor (`aaaa-mm-dd`). */
export const subtractBahiaCivilDays = (civilDate: string, days: number): string => {
  const [year, month, day] = civilDate.split('-').map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day))
  anchor.setUTCDate(anchor.getUTCDate() - days)
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(anchor.getUTCDate())}`
}

/**
 * Latest of two ISO timestamps, ignoring nulls. String comparison is only
 * sound because every writer here produces fixed-width UTC — Payload's own
 * `createdAt`/`updatedAt` and our `new Date().toISOString()` hooks. An offset
 * form (`-03:00`) or variable precision would break it.
 */
export const latestIsoTimestamp = (
  left: string | null | undefined,
  right: string | null | undefined,
): string | null => {
  if (!left) return right ?? null
  if (!right) return left
  return right > left ? right : left
}
