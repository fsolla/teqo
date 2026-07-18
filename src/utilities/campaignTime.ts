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

const addCivilDays = (civil: CivilDateTime, days: number): CivilDateTime => {
  const date = new Date(civilAsUtcMilliseconds(civil))
  date.setUTCDate(date.getUTCDate() + days)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: civil.hour,
    minute: civil.minute,
    second: civil.second,
  }
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
  const pad = (value: number): string => String(value).padStart(2, '0')

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

export const getBahiaWeekRange = (now: Date): { start: Date; end: Date } => {
  const local = getZonedParts(now)
  const localMidnight = { ...local, hour: 0, minute: 0, second: 0 }
  const weekday = new Date(
    Date.UTC(localMidnight.year, localMidnight.month - 1, localMidnight.day),
  ).getUTCDay()
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  const monday = addCivilDays(localMidnight, -daysSinceMonday)
  const nextMonday = addCivilDays(monday, 7)

  return {
    start: zonedCivilToInstant(monday),
    end: zonedCivilToInstant(nextMonday),
  }
}
