export const CONTACT_SEARCH_MIN_LENGTH = 2

export const normalizeContactSearchQuery = (raw: string) => {
  const trimmed = raw.trim().slice(0, 120)
  const digits = trimmed.replace(/\D/g, '')
  return { trimmed, digits }
}

export const isContactSearchQueryReady = (raw: string) => {
  const { trimmed, digits } = normalizeContactSearchQuery(raw)
  return (
    trimmed.length >= CONTACT_SEARCH_MIN_LENGTH || digits.length >= CONTACT_SEARCH_MIN_LENGTH
  )
}
