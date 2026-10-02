// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const MAX_WIDTH = 1600
const MAX_HEIGHT = 2400

const LOCAL_IMAGE_REF = /src[=:]\s*['"](\/[^'"`]+\.(?:avif|webp|png|jpe?g))['"]/g

// `image:` covers the home card data (`CampaignCarouselItem.image`), which is
// also rendered through next/image — the dimension budget above only walks
// `src` literals on purpose (the card masters predate the budget), but the
// AVIF ban below must catch both spellings.
const LOCAL_IMAGE_LITERAL = /(?:src|image)[=:]\s*['"](\/[^'"`]+\.(?:avif|webp|png|jpe?g))['"]/g

const publicFile = (src: string) =>
  fileURLToPath(new URL(`../../public${decodeURIComponent(src)}`, import.meta.url))

const campaignHeroSource = readFileSync(
  fileURLToPath(new URL('../../src/components/CampaignHero.tsx', import.meta.url)),
  'utf8',
)

const localHeroAssets = [
  ...new Set([...campaignHeroSource.matchAll(LOCAL_IMAGE_REF)].map(([, src]) => src)),
]

const collectSourceImageRefs = (pattern: RegExp) => {
  const refs = new Set<string>()
  const srcDir = fileURLToPath(new URL('../../src', import.meta.url))

  for (const entry of readdirSync(srcDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) continue
    const code = readFileSync(join(entry.parentPath, entry.name), 'utf8')
    for (const [, src] of code.matchAll(pattern)) refs.add(src)
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
    const refs = [...collectSourceImageRefs(LOCAL_IMAGE_REF)].filter((src) =>
      existsSync(publicFile(src)),
    )
    expect(refs.length).toBeGreaterThan(0)

    for (const src of refs) {
      const { width, height } = await sharp(publicFile(src)).metadata()
      expect(width, src).toBeLessThanOrEqual(MAX_WIDTH)
      expect(height, src).toBeLessThanOrEqual(MAX_HEIGHT)
    }
  })

  it('não entrega AVIF pelo otimizador (libheif: GHSA-2xp9-vwfh-vxw4 e travamento por chave)', () => {
    const refs = [...collectSourceImageRefs(LOCAL_IMAGE_LITERAL)]
    expect(refs.length).toBeGreaterThan(0)

    for (const src of refs) {
      expect(src.endsWith('.avif'), src).toBe(false)
    }
  })

  it('não mantém AVIF em public/ — o otimizador decodifica qualquer arquivo local por URL', () => {
    const publicDir = fileURLToPath(new URL('../../public', import.meta.url))
    const avifFiles = readdirSync(publicDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.avif'))
      .map((entry) => entry.name)

    expect(avifFiles).toEqual([])
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
