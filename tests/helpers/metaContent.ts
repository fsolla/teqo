/** Reads a meta tag by one attribute and returns its `content` (attribute-order tolerant). */
export const metaContent = (html: string, attribute: string, value: string): string | null => {
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    if (!tag.includes(`${attribute}="${value}"`)) continue
    return tag.match(/content="([^"]*)"/)?.[1] ?? null
  }
  return null
}
