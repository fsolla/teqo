import { redirect } from 'next/navigation'

import { buildAcervoSourceHref } from '@/lib/acervoSource'

/**
 * C199 — canonical alias of the recordings source. The list lives on
 * `/campanha/comunicacao/acervo?source=enviadas` (the switcher keeps both
 * sources on the same page); this segment exists so a hand-typed URL lands on
 * the source instead of being swallowed by the `[id]` detail route.
 */
export default function RecordingsAliasPage() {
  redirect(buildAcervoSourceHref('enviadas'))
}
