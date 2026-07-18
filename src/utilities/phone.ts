const BRAZIL_COUNTRY_CODE = '55'
const BRAZILIAN_MOBILE_PHONE_LENGTH = 11

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

export const buildWhatsAppUrl = (phone: string, message?: string): string => {
  const normalizedPhone = normalizeBrazilianPhone(phone)

  if (!normalizedPhone) {
    throw new Error('Celular brasileiro inválido.')
  }

  const url = new URL(`https://wa.me/${BRAZIL_COUNTRY_CODE}${normalizedPhone}`)

  if (message) {
    url.searchParams.set('text', message)
  }

  return url.toString()
}
