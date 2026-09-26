/** A slug as this module produces it: lowercase alphanumerics, hyphen-separated. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> hyphen
    .replace(/-+/g, '-') // collapse hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
