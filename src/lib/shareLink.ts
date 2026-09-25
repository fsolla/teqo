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
export const SHARE_LINK_LIVE_DUPLICATE_MESSAGE =
  'Apenas um destino pode ficar no ar. Desmarque os outros para continuar.'
export const SHARE_LINK_DIRECT_WITHOUT_LIVE_MESSAGE =
  'No modo "Levar direto ao destino", marque um destino no ar. Para deixar o link em pré-transmissão, use o modo "Página de anúncio".'
export const SHARE_LINK_EVENT_END_BEFORE_START_MESSAGE =
  'O horário de término deve ser posterior ao de início.'

/**
 * S29 — per-link mode. `direct` is the S19 behavior (the click goes straight to
 * the destination); `announcement` serves the announcement page while no
 * destination is on air. A legacy/null value means `direct`: existing links
 * never change behavior.
 */
export const SHARE_LINK_MODES = ['direct', 'announcement'] as const
export type ShareLinkMode = (typeof SHARE_LINK_MODES)[number]

export const SHARE_LINK_MODE_OPTIONS: { label: string; value: ShareLinkMode }[] = [
  { label: 'Levar direto ao destino', value: 'direct' },
  { label: 'Página de anúncio', value: 'announcement' },
]

export const resolveShareLinkMode = (value: string | null | undefined): ShareLinkMode =>
  value === 'announcement' ? 'announcement' : 'direct'

/** Structural shape of one pre-registered destination (Payload array row). */
export type ShareLinkDestinationLike = {
  label?: string | null
  url?: string | null
  live?: boolean | null
}

export type ShareLinkLiveTarget = { href: string; label: string }

/**
 * The destination currently on air: the first row flagged `live` whose URL is
 * a valid `http`/`https` one. Fail-closed — a malformed row never leaks a
 * destination and the link behaves as pre-broadcast.
 */
export const resolveLiveShareLinkDestination = (
  destinations: ShareLinkDestinationLike[] | null | undefined,
): ShareLinkLiveTarget | null => {
  if (!destinations?.length) return null

  for (const destination of destinations) {
    if (!destination?.live) continue
    const url = typeof destination.url === 'string' ? destination.url.trim() : ''
    if (!isValidShareLinkDestination(url)) continue
    return { href: url, label: (destination.label ?? '').trim() }
  }

  return null
}

/** Public path contract: a single root segment (`jorgesolla1313.com.br/<slug>`). */
export const shareLinkPath = (slug: string): string => `/${slug}`

/**
 * S29 — the `.ics` download of an announcement link. It hangs off the slug's
 * own namespace (`/<slug>/evento.ics`) as a static sibling of the `[category]`
 * listing route, so the 1-segment share-link contract stays untouched.
 */
export const shareLinkIcsPath = (slug: string): string => `/${slug}/evento.ics`

/** Deterministic UID of the announcement event — one event per link. */
export const shareLinkIcsUid = (slug: string): string => `${slug}@teqo.jorgesolla.com.br`

export const isValidShareLinkSlug = (value: string): boolean => SHARE_LINK_SLUG_PATTERN.test(value)

export const isReservedShareLinkSlug = (value: string): boolean =>
  (SHARE_LINK_RESERVED_SLUGS as readonly string[]).includes(value)

export const normalizeAbsoluteHttpUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
  ) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/** Only `http`/`https` absolute URLs are accepted; anything else fails closed. */
export const isValidShareLinkDestination = (value: string): boolean =>
  normalizeAbsoluteHttpUrl(value) !== null

/** Collapse whitespace so the value is safe inside a single-line meta tag. */
export const normalizeShareLinkDescription = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()
