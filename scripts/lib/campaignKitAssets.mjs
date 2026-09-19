/**
 * Official campaign kit assets (C196/C203): reads the committed PNGs under
 * `public/campaign-kit` as data URIs, so every local renderer embeds the brand
 * without network access. The default root resolves from this module (never
 * the cwd): the chart entry runs from temp dirs in the tests and the e2e.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT_ASSETS = {
  namePositive: 'jorge-solla-positivo.png',
  nameNegative: 'jorge-solla-negativo.png',
  completePositive: 'marca-positiva-completa.png',
  completeNegative: 'marca-negativa-completa.png',
  star: 'estrela.png',
}

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Official campaign kit marks as data URIs (committed under `public/campaign-kit`). */
export const readKitAssets = async ({ root = defaultRoot } = {}) => {
  const entries = await Promise.all(
    Object.entries(KIT_ASSETS).map(async ([key, file]) => {
      const bytes = await readFile(resolve(root, 'public/campaign-kit', file))
      return [key, `data:image/png;base64,${bytes.toString('base64')}`]
    }),
  )
  return Object.fromEntries(entries)
}
