import { describe, expect, it } from 'vitest'

import {
  drawSectionStory,
  STORY_HEIGHT,
  STORY_WIDTH,
  type SectionStoryDrawContext,
  type SectionStoryInput,
} from '@/lib/sectionStoryRender'

type FillCall = { text: string; x: number; y: number; font: string; fillStyle: string }

type Recorder = SectionStoryDrawContext & {
  texts: FillCall[]
  rects: { x: number; y: number; width: number; height: number; fillStyle: string }[]
  strokes: { dash: number[]; strokeStyle: string }[]
  lineDash: number[]
}

const createRecorder = () => {
  const texts: FillCall[] = []
  const rects: { x: number; y: number; width: number; height: number; fillStyle: string }[] = []
  const strokes: { dash: number[]; strokeStyle: string }[] = []

  const ctx: Recorder = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: 'left',
    textBaseline: 'top',
    letterSpacing: '',
    fillRect(x, y, width, height) {
      rects.push({ x, y, width, height, fillStyle: String(ctx.fillStyle) })
    },
    fillText(text, x, y) {
      texts.push({ text, x, y, font: ctx.font, fillStyle: String(ctx.fillStyle) })
    },
    // Largura proporcional ao tamanho da fonte corrente — suficiente para o wrap.
    measureText(text) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? '16')
      return { width: text.length * size * 0.52 }
    },
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokes.push({ dash: ctx.lineDash, strokeStyle: String(ctx.strokeStyle) })
    },
    setLineDash(segments) {
      ctx.lineDash = [...segments]
    },
    roundRect() {},
    lineDash: [] as number[],
    texts,
    rects,
    strokes,
  }
  return ctx
}

const input = (overrides: Partial<SectionStoryInput> = {}): SectionStoryInput => ({
  municipalityName: 'Serrinha',
  uf: 'BA',
  zone: 150,
  section: 50,
  firstRound: '66,9%',
  immediate: '73,7%',
  total: '79,8%',
  gainImmediate: '+6,8 p.p.',
  gainTotal: '+12,9 p.p.',
  fontFamily: 'Arimo, Arial, sans-serif',
  ...overrides,
})

describe('drawSectionStory', () => {
  it('paints the 1080×1920 off-white background', () => {
    const ctx = createRecorder()
    drawSectionStory(ctx, input())
    expect(ctx.rects[0]).toEqual({
      x: 0,
      y: 0,
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      fillStyle: '#f7f6f3',
    })
  })

  it('draws the section identity, the three readings and both gains', () => {
    const ctx = createRecorder()
    drawSectionStory(ctx, input())
    const drawn = ctx.texts.map((call) => call.text)
    const joined = drawn.join(' ')
    expect(joined).toContain('2º TURNO · 25/10')
    expect(joined).toContain('Quanto o Lula pode crescer na sua seção?')
    expect(joined).toContain('Serrinha · BA')
    expect(joined).toContain('Zona 150 · Seção 50')
    expect(joined).toContain('66,9%')
    expect(joined).toContain('73,7%')
    expect(joined).toContain('79,8%')
    expect(joined).toContain('+6,8 p.p.')
    expect(joined).toContain('+12,9 p.p.')
    expect(joined).toContain('X₁')
    expect(joined).toContain('X₂')
  })

  it('draws the hero gain with the 700 48px face and keeps every text inside the canvas', () => {
    const ctx = createRecorder()
    drawSectionStory(ctx, input())
    const hero = ctx.texts.find((call) => call.text === '+12,9 p.p.')
    expect(hero?.font).toContain('700 48px')
    for (const call of ctx.texts) {
      expect(call.y).toBeGreaterThanOrEqual(0)
      expect(call.y).toBeLessThan(STORY_HEIGHT)
      expect(call.x).toBeGreaterThanOrEqual(0)
      expect(call.x).toBeLessThanOrEqual(STORY_WIDTH)
    }
  })

  it('reserves the bottom link area with a dashed border', () => {
    const ctx = createRecorder()
    drawSectionStory(ctx, input())
    expect(ctx.strokes.some((stroke) => stroke.dash.length === 2)).toBe(true)
  })

  it('clamps a long município name to two lines with an ellipsis', () => {
    const ctx = createRecorder()
    drawSectionStory(
      ctx,
      input({
        municipalityName:
          'São José do Vale do Rio Preto do Norte do Sertão do Cariri Paraibano da Serra do Mar e do Vale do Rio Doce de Minas Gerais do Oeste Baiano',
      }),
    )
    expect(ctx.texts.some((call) => call.text.endsWith('…'))).toBe(true)
  })
})
