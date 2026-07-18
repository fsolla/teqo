export class TseZoneParseError extends Error {}

export const parseTseZoneNumbers = (value: string): number[] => {
  if (!/^[\d,\s]*$/.test(value)) {
    throw new TseZoneParseError('Use apenas números, vírgulas e espaços nas Zonas TSE.')
  }

  return [
    ...new Set(
      value
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((token) => {
          const zoneNumber = Number(token)
          if (!Number.isInteger(zoneNumber) || zoneNumber < 1 || zoneNumber > 999) {
            throw new TseZoneParseError(
              `Zona TSE inválida: "${token}". Use números de 1 a 999.`,
            )
          }
          return zoneNumber
        }),
    ),
  ].sort((left, right) => left - right)
}
