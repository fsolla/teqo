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

/**
 * Official campaign kit marks as data URIs (committed under `public/campaign-kit`).
 *
 * @param {{ root?: string, keys?: string[] }} [options] repo root (defaults to
 *   this module's repo) and the asset keys to read (defaults to all).
 * @returns {Promise<Record<string, string>>} data URI per requested key.
 */
export const readKitAssets = async ({
  root = defaultRoot,
  keys = Object.keys(KIT_ASSETS),
} = {}) => {
  const entries = await Promise.all(
    keys.map(async (key) => {
      const file = KIT_ASSETS[key]
      if (!file) throw new Error(`ativo do kit desconhecido: ${key}`)
      const bytes = await readFile(resolve(root, 'public/campaign-kit', file))
      return [key, `data:image/png;base64,${bytes.toString('base64')}`]
    }),
  )
  return Object.fromEntries(entries)
}
