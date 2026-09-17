/**
 * Shared print-text contract for the Report builders (C163 city report + C186
 * dossiê/boletim): escaping, bare-URL anchors and the inline-source tokens
 * (`{{fonte}}` / `{{fonte:N}}`). Extracted from `cityReportRender.mjs` so the
 * dossiê renderer does not twin the subtle token resolution — one owner, two
 * consumers.
 */

export const htmlEscape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/** Escapes the text and turns every bare URL into a clickable anchor (PDF links). */
export const htmlWithLinks = (value) =>
  htmlEscape(value).replace(URL_PATTERN, (url) => `<a href="${url}">${url}</a>`)

const INLINE_SOURCE_PATTERN = /\{\{fonte(?::(\d+))?\}\}/g

/** Drops the inline-source tokens (no source surface, e.g. the boletim). */
export const stripInlineSources = (value) =>
  String(value ?? '')
    .replace(INLINE_SOURCE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()

/**
 * Resolves the `{{fonte}}` / `{{fonte:N}}` tokens the content model leaves in
 * the citation text into `(fonte)` anchors — inline, right where the excerpt
 * cites the verified fact, so one text can point to more than one source.
 */
export const renderInlineSourcesHtml = (value, sources) =>
  htmlWithLinks(value).replace(INLINE_SOURCE_PATTERN, (_match, index) => {
    const position = Number(index ?? 1) - 1
    const url = sources?.[position]
    if (!url) return ''
    const label = sources.length > 1 ? `(fonte ${position + 1})` : '(fonte)'
    return ` <a class="inline-source" href="${htmlEscape(url)}">${label}</a>`
  })

export const renderInlineSourcesMd = (value, sources) =>
  String(value ?? '').replace(INLINE_SOURCE_PATTERN, (_match, index) => {
    const position = Number(index ?? 1) - 1
    const url = sources?.[position]
    if (!url) return ''
    const label = sources.length > 1 ? `fonte ${position + 1}` : 'fonte'
    return ` [(${label})](${url})`
  })
