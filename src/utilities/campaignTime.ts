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
