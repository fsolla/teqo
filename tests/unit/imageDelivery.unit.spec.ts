// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const MAX_WIDTH = 1600
const MAX_HEIGHT = 2400

const LOCAL_IMAGE_REF = /src[=:]\s*['"](\/[^'"`]+\.(?:avif|webp|png|jpe?g))['"]/g

const publicFile = (src: string) =>
  fileURLToPath(new URL(`../../public${decodeURIComponent(src)}`, import.meta.url))

const campaignHeroSource = readFileSync(
  fileURLToPath(new URL('../../src/components/CampaignHero.tsx', import.meta.url)),
  'utf8',
)

const localHeroAssets = [
  ...new Set([...campaignHeroSource.matchAll(LOCAL_IMAGE_REF)].map(([, src]) => src)),
]

const collectSourceImageRefs = () => {
  const refs = new Set<string>()
  const srcDir = fileURLToPath(new URL('../../src', import.meta.url))

  for (const entry of readdirSync(srcDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) continue
    const code = readFileSync(join(entry.parentPath, entry.name), 'utf8')
    for (const [, src] of code.matchAll(LOCAL_IMAGE_REF)) refs.add(src)
  }

  return refs
}

describe('entrega das imagens do hero (perf do /_next/image)', () => {
  it('usa masters no tamanho máximo de exibição, sem forçar decode de 3840px', async () => {
    expect(localHeroAssets.length).toBeGreaterThanOrEqual(5)

    for (const src of localHeroAssets) {
      const { width, height } = await sharp(publicFile(src)).metadata()
      expect(width, src).toBeLessThanOrEqual(MAX_WIDTH)
      expect(height, src).toBeLessThanOrEqual(MAX_HEIGHT)
    }
  })

  it('mantém todo asset local entregue via next/image dentro do orçamento', async () => {
    const refs = [...collectSourceImageRefs()].filter((src) => existsSync(publicFile(src)))
    expect(refs.length).toBeGreaterThan(0)

    for (const src of refs) {
      const { width, height } = await sharp(publicFile(src)).metadata()
      expect(width, src).toBeLessThanOrEqual(MAX_WIDTH)
      expect(height, src).toBeLessThanOrEqual(MAX_HEIGHT)
    }
  })

  it('configura TTL longo para os derivados do otimizador', () => {
    const nextConfig = readFileSync(
      fileURLToPath(new URL('../../next.config.mjs', import.meta.url)),
      'utf8',
    )

    const ttl = nextConfig.match(/minimumCacheTTL:\s*(\d+)/)
    expect(ttl, 'next.config.mjs deve definir images.minimumCacheTTL').toBeTruthy()
    expect(Number(ttl?.[1])).toBeGreaterThanOrEqual(3600)
  })
})
