const BRAZIL_COUNTRY_CODE = '55'
const BRAZILIAN_MOBILE_PHONE_LENGTH = 11

/** One refusal copy for the URL builder, the zod primitive and the Contact hook — rewording in one layer only would give the same refusal two phrasings. */
export const BRAZILIAN_PHONE_INVALID_MESSAGE = 'Celular brasileiro inválido.'

/** A ficha may not hold the same number twice (the person already has it); sharing a number BETWEEN fichas stays allowed (C111). */
export const BRAZILIAN_PHONE_DUPLICATE_MESSAGE = 'Telefone repetido na ficha.'

export const sanitizeBrazilianPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  const domesticDigits =
    digits.length > BRAZILIAN_MOBILE_PHONE_LENGTH && digits.startsWith(BRAZIL_COUNTRY_CODE)
      ? digits.slice(BRAZIL_COUNTRY_CODE.length)
      : digits

  return domesticDigits.slice(0, BRAZILIAN_MOBILE_PHONE_LENGTH)
}

export const formatBrazilianPhoneInput = (value: string): string => {
  const digits = sanitizeBrazilianPhoneInput(value)

  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export const normalizeBrazilianPhone = (value: string): string | null => {
  let digits = value.replace(/\D/g, '')

  if (digits.length === BRAZILIAN_MOBILE_PHONE_LENGTH + BRAZIL_COUNTRY_CODE.length) {
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) return null
    digits = digits.slice(BRAZIL_COUNTRY_CODE.length)
  }

  if (!/^[1-9]{2}9\d{8}$/.test(digits)) return null

  return digits
}

/** Display formatting for a normalized 11-digit mobile: (71) 99999-9999 — the input formatter's final shape, named for display call sites. */
export const formatBrazilianPhoneDisplay = formatBrazilianPhoneInput

export const buildWhatsAppUrl = (phone: string, message?: string): string => {
  const normalizedPhone = normalizeBrazilianPhone(phone)

  if (!normalizedPhone) {
    throw new Error(BRAZILIAN_PHONE_INVALID_MESSAGE)
  }

  const url = new URL(`https://wa.me/${BRAZIL_COUNTRY_CODE}${normalizedPhone}`)

  if (message) {
    url.searchParams.set('text', message)
  }

  return url.toString()
}

/** `wa.me` href for a row's phone, or `null` when it doesn't normalize — the shared guard behind every per-row WhatsApp button in the campaign lists. */
export const whatsAppHrefForPhone = (phone: string | null): string | null => {
  if (!phone || !normalizeBrazilianPhone(phone)) return null
  return buildWhatsAppUrl(phone)
}

/**
 * The person's primary phone from the `Contact.phones` array: order is
 * priority (first = primary), so the row/list/WhatsApp/convite readers all go
 * through this single translation and never touch the array shape.
 */
export const primaryPhoneOf = (
  phones: ReadonlyArray<{ value?: string | null }> | null | undefined,
): string | null => phones?.[0]?.value || null

/** Every number of the ficha in priority order, empties dropped. */
export const phoneValuesOf = (
  phones: ReadonlyArray<{ value?: string | null }> | null | undefined,
): string[] =>
  (phones ?? []).map((entry) => entry.value).filter((value): value is string => Boolean(value))

/**
 * Edit the primary phone preserving the rest: the next primary goes first
 * (any earlier occurrence removed — the number the person already had moves,
 * never duplicates), and an empty `primary` removes the current first number
 * so the rest shifts up.
 */
export const reorderWithPrimaryPhone = (
  phones: ReadonlyArray<{ value?: string | null }> | null | undefined,
  primary: string | null,
): string[] => {
  const current = (phones ?? [])
    .map((entry) => entry.value)
    .filter((value): value is string => Boolean(value))
  const rest = current.filter((phone) => phone !== primary)
  return primary ? [primary, ...rest] : current.slice(1)
}
