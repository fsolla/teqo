import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parsePotentialShard, type PotentialUfShard } from '@/lib/sectionPotential'

/**
 * S46 — the server-side reader of the committed TSE shards. The artifact lives
 * under `public/` (copied into the standalone image by the Dockerfile) and is
 * immutable per deploy, so one parse per UF per process is enough; a missing or
 * malformed file answers `null` and every caller fails closed.
 */
const SHARD_DIR = join(process.cwd(), 'public', 'dados', 'potencial-secao-2026')

const shardCache = new Map<string, Promise<PotentialUfShard | null>>()

export const loadPotentialUfShard = (uf: string): Promise<PotentialUfShard | null> => {
  const normalized = uf.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) return Promise.resolve(null)

  const cached = shardCache.get(normalized)
  if (cached) return cached

  const promise = readFile(join(SHARD_DIR, `${normalized}.json`), 'utf8')
    .then((text) => parsePotentialShard(JSON.parse(text)))
    .catch(() => null)

  shardCache.set(normalized, promise)
  return promise
}
