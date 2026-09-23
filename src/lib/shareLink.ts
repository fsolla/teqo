export const SHARE_LINK_TITLE_MAX_LENGTH = 90
export const SHARE_LINK_DESCRIPTION_MAX_LENGTH = 160

/**
 * Slugs that would collide with a route or a route value of the public site.
 * The drift unit test keeps this list in sync with the static segments under
 * `src/app/(frontend)` and with the post type enum (`src/utilities/posts.ts`).
 */
export const SHARE_LINK_RESERVED_SLUGS = [
  'cards',
  'artigos',
  'corte',
  'privacidade',
  'mandato-no-whatsapp',
  'abaixo-assinado',
  'jingles',
  'conteudos',
  'api',
  'admin',
  'noticia',
  'campanha',
  'artigo',
  'evento',
] as const

export const SHARE_LINK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const SHARE_LINK_SLUG_INVALID_MESSAGE =
  'Use apenas letras minúsculas, números e hífens (ex.: plenaria-saude).'
export const SHARE_LINK_SLUG_RESERVED_MESSAGE =
  'Este endereço é reservado pelo site. Escolha outro slug.'
export const SHARE_LINK_SLUG_DUPLICATE_MESSAGE =
  'Já existe um link de compartilhamento com este slug.'
export const SHARE_LINK_DESTINATION_INVALID_MESSAGE =
  'Informe uma URL completa começando com http:// ou https://.'

/** Public path contract: a single root segment (`jorgesolla1313.com.br/<slug>`). */
export const shareLinkPath = (slug: string): string => `/${slug}`

export const isValidShareLinkSlug = (value: string): boolean => SHARE_LINK_SLUG_PATTERN.test(value)

export const isReservedShareLinkSlug = (value: string): boolean =>
  (SHARE_LINK_RESERVED_SLUGS as readonly string[]).includes(value)

/** Only `http`/`https` absolute URLs are accepted; anything else fails closed. */
export const isValidShareLinkDestination = (value: string): boolean => {
  if (!/^https?:\/\//i.test(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Collapse whitespace so the value is safe inside a single-line meta tag. */
export const normalizeShareLinkDescription = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()
