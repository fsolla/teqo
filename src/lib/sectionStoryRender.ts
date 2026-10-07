/**
 * S46 — the pure canvas renderer of the story 1080×1920. The design artifact
 * (`docs/plans/potencial-secao-story-ui-design.html`, cena 4) defines the
 * geometry in container-query units over a 1080-wide story; every constant
 * below is that value × 10.8. The caller passes the numbers already formatted
 * by `sectionPotential`, so the image and the page can never disagree.
 *
 * The context is a structural subset of `CanvasRenderingContext2D` so unit
 * tests drive a fake recorder instead of a real canvas.
 */

export const STORY_WIDTH = 1080
export const STORY_HEIGHT = 1920

/**
 * The story's own copy, shared with the page where the sentence is the same
 * (the headline and the hypothesis): a single source, so the screen and the
 * image can never disagree on what the campaign is saying.
 */
export const SECTION_STORY_TITLE = 'Quanto o Lula pode crescer na sua seção?'
export const SECTION_STORY_HYPOTHESIS =
  'todos os votos disponíveis vão para o Lula e o Flávio mantém os votos dele.'

const COLORS = {
  background: '#f7f6f3',
  ink: '#1b1b1b',
  title: '#141414',
  muted: '#57534c',
  kicker: '#8c8880',
  rowNumber: '#a39e95',
  rowSmall: '#837e76',
  legend: '#6e6a63',
  hairline: '#dcd9d2',
  linkBorder: '#cbc7bf',
} as const

/** cqw → px on the 1080-wide story (1cqw = 10.8px). */
const PX = {
  padX: 84,
  padTop: 118,
  padBottom: 108,
  kickerSize: 23,
  kickerSpacing: 2.5,
  titleSize: 58,
  titleLineHeight: 1.16,
  titleSpacing: -0.5,
  titleMarginTop: 26,
  subSize: 27,
  subLineHeight: 1.45,
  subMarginTop: 22,
  fieldsMarginTop: 39,
  fieldPaddingY: 14,
  fieldGap: 20,
  numWidth: 38,
  numSize: 27,
  nameSize: 29,
  nameLineHeight: 1.18,
  smallSize: 21,
  smallLineHeight: 1.3,
  smallMarginTop: 3,
  valueSize: 34,
  valueSmallSize: 27,
  valueHeroSize: 48,
  formulaMarginTop: 48,
  formulaTitleSize: 22,
  formulaTitleSpacing: 2,
  calcSize: 25,
  calcLineHeight: 1.45,
  calcMarginTop: 13,
  legendMarginTop: 26,
  legendSize: 21,
  legendLineHeight: 1.5,
  legendPaddingTop: 18,
  linkHeight: 100,
  linkRadius: 10,
  hairline: 1.5,
} as const

export type SectionStoryDrawContext = {
  font: string
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  letterSpacing: string
  fillRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  save(): void
  restore(): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  setLineDash(segments: number[]): void
  roundRect(x: number, y: number, width: number, height: number, radii?: number | number[]): void
}

export type SectionStoryInput = {
  municipalityName: string
  uf: string
  zone: number
  section: number
  /** Já formatados por `sectionPotential` (1 casa, pt-BR). */
  firstRound: string
  immediate: string
  total: string
  gainImmediate: string
  gainTotal: string
  fontFamily: string
}

type StoryWord = { text: string; weight: number; color: string }

const setFont = (ctx: SectionStoryDrawContext, weight: number, size: number, family: string) => {
  ctx.font = `${weight} ${size}px ${family}`
}

const wordsOf = (text: string, weight: number, color: string): StoryWord[] =>
  text.split(' ').map((word) => ({ text: word, weight, color }))

const richWords = (segments: { text: string; weight?: number; color?: string }[], color: string) =>
  segments.flatMap((segment) =>
    wordsOf(segment.text, segment.weight ?? 400, segment.color ?? color),
  )

/** Greedy word wrap over styled words; the caller sets the size/family. */
const wrapWords = (
  ctx: SectionStoryDrawContext,
  words: StoryWord[],
  maxWidth: number,
  size: number,
  family: string,
): StoryWord[][] => {
  const lines: StoryWord[][] = []
  let line: StoryWord[] = []
  let lineWidth = 0
  const space = () => {
    setFont(ctx, 400, size, family)
    return ctx.measureText(' ').width
  }
  for (const word of words) {
    setFont(ctx, word.weight, size, family)
    const width = ctx.measureText(word.text).width
    const next = line.length === 0 ? width : lineWidth + space() + width
    if (line.length > 0 && next > maxWidth) {
      lines.push(line)
      line = [word]
      lineWidth = width
    } else {
      line.push(word)
      lineWidth = next
    }
  }
  if (line.length > 0) lines.push(line)
  return lines
}

const drawWords = (
  ctx: SectionStoryDrawContext,
  words: StoryWord[],
  x: number,
  y: number,
  size: number,
  family: string,
) => {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let cursor = x
  for (const [index, word] of words.entries()) {
    setFont(ctx, word.weight, size, family)
    ctx.fillStyle = word.color
    if (index > 0) cursor += ctx.measureText(' ').width
    ctx.fillText(word.text, cursor, y)
    cursor += ctx.measureText(word.text).width
  }
}

const drawWrapped = (
  ctx: SectionStoryDrawContext,
  words: StoryWord[],
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  family: string,
): number => {
  const lines = wrapWords(ctx, words, maxWidth, size, family)
  for (const [index, line] of lines.entries()) {
    drawWords(ctx, line, x, y + index * size * lineHeight, size, family)
  }
  return y + lines.length * size * lineHeight
}

/** Truncates a wrapped text to `maxLines`, adding an ellipsis to the last one. */
const drawWrappedClamped = (
  ctx: SectionStoryDrawContext,
  words: StoryWord[],
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  maxLines: number,
  family: string,
): number => {
  const lines = wrapWords(ctx, words, maxWidth, size, family)
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines && visible.length > 0) {
    const last = visible[visible.length - 1]
    setFont(ctx, 400, size, family)
    let text = last.map((word) => word.text).join(' ')
    while (text.length > 0 && ctx.measureText(`${text}…`).width > maxWidth) {
      text = text.slice(0, -1).trimEnd()
    }
    visible[visible.length - 1] = [{ ...last[0], text: `${text}…` }]
  }
  for (const [index, line] of visible.entries()) {
    drawWords(ctx, line, x, y + index * size * lineHeight, size, family)
  }
  return y + visible.length * size * lineHeight
}

const drawHairline = (ctx: SectionStoryDrawContext, y: number, x0: number, x1: number) => {
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = COLORS.hairline
  ctx.lineWidth = PX.hairline
  ctx.setLineDash([])
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.restore()
}

type StoryField = {
  number: string
  name: string
  small: string
  value: string
  valueKind: 'small' | 'default' | 'hero'
}

/**
 * Draws the whole story on a 1080×1920 context. Pure: no DOM, no fonts API —
 * the caller must have loaded `fontFamily` (weights 400/500/600/700) first.
 */
export const drawSectionStory = (ctx: SectionStoryDrawContext, input: SectionStoryInput): void => {
  const family = input.fontFamily
  const left = PX.padX
  const right = STORY_WIDTH - PX.padX
  const maxWidth = right - left

  ctx.save()
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  let y: number = PX.padTop

  ctx.letterSpacing = `${PX.kickerSpacing}px`
  setFont(ctx, 500, PX.kickerSize, family)
  ctx.fillStyle = COLORS.kicker
  ctx.fillText('2º TURNO · 25/10', left, y)
  y += PX.kickerSize * 1.3

  ctx.letterSpacing = `${PX.titleSpacing}px`
  y += PX.titleMarginTop
  y = drawWrapped(
    ctx,
    wordsOf(SECTION_STORY_TITLE, 600, COLORS.title),
    left,
    y,
    maxWidth,
    PX.titleSize,
    PX.titleLineHeight,
    family,
  )
  ctx.letterSpacing = '0px'

  y += PX.subMarginTop
  y = drawWrapped(
    ctx,
    richWords(
      [
        { text: 'Cenário só ' },
        { text: 'Lula × Flávio', weight: 600, color: '#2b2b2b' },
        { text: ` nesta seção: ${SECTION_STORY_HYPOTHESIS}` },
      ],
      COLORS.muted,
    ),
    left,
    y,
    maxWidth,
    PX.subSize,
    PX.subLineHeight,
    family,
  )

  const fields: StoryField[] = [
    {
      number: '1.',
      name: 'Sua seção',
      small: `${input.municipalityName} · ${input.uf}`,
      value: `Zona ${input.zone} · Seção ${input.section}`,
      valueKind: 'small',
    },
    {
      number: '2.',
      name: 'Lula no 1º turno',
      small: 'dos votos válidos na seção',
      value: input.firstRound,
      valueKind: 'default',
    },
    {
      number: '3.',
      name: 'Lula no 2º turno',
      small: 'só votos imediatos (X₁)',
      value: input.immediate,
      valueKind: 'default',
    },
    {
      number: '4.',
      name: 'Lula no 2º turno',
      small: 'todos os votos (X₂)',
      value: input.total,
      valueKind: 'default',
    },
    {
      number: '5.',
      name: 'Ganho imediato',
      small: '2º − 1º, em pontos percentuais',
      value: input.gainImmediate,
      valueKind: 'default',
    },
    {
      number: '6.',
      name: 'Ganho total',
      small: '2º − 1º, em pontos percentuais',
      value: input.gainTotal,
      valueKind: 'hero',
    },
  ]

  y += PX.fieldsMarginTop
  drawHairline(ctx, y, left, right)

  const labelX = left + PX.numWidth + PX.fieldGap
  const labelMaxWidth = right - labelX - 220
  for (const field of fields) {
    const valueSize =
      field.valueKind === 'hero'
        ? PX.valueHeroSize
        : field.valueKind === 'small'
          ? PX.valueSmallSize
          : PX.valueSize
    const valueWeight = field.valueKind === 'hero' ? 700 : field.valueKind === 'small' ? 500 : 600

    const rowTop = y + PX.fieldPaddingY
    setFont(ctx, 500, PX.numSize, family)
    ctx.fillStyle = COLORS.rowNumber
    ctx.fillText(field.number, left, rowTop + 2)

    const nameBottom = drawWrapped(
      ctx,
      wordsOf(field.name, 500, COLORS.ink),
      labelX,
      rowTop,
      labelMaxWidth,
      PX.nameSize,
      PX.nameLineHeight,
      family,
    )
    const smallBottom = drawWrappedClamped(
      ctx,
      wordsOf(field.small, 400, COLORS.rowSmall),
      labelX,
      nameBottom + PX.smallMarginTop,
      labelMaxWidth,
      PX.smallSize,
      PX.smallLineHeight,
      2,
      family,
    )

    setFont(ctx, valueWeight, valueSize, family)
    ctx.fillStyle = COLORS.title
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const valueMiddle = rowTop + Math.max(nameBottom - rowTop, PX.nameSize * PX.nameLineHeight) / 2
    ctx.fillText(field.value, right, valueMiddle)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const rowHeight = Math.max(smallBottom - rowTop, valueSize) + 2 * PX.fieldPaddingY
    y += rowHeight
    drawHairline(ctx, y, left, right)
  }

  y += PX.formulaMarginTop
  ctx.letterSpacing = `${PX.formulaTitleSpacing}px`
  setFont(ctx, 500, PX.formulaTitleSize, family)
  ctx.fillStyle = COLORS.kicker
  ctx.fillText('A CONTA (COMO NO TSE: % = VOTOS ÷ VOTOS VÁLIDOS)', left, y)
  ctx.letterSpacing = '0px'
  y += PX.formulaTitleSize * 1.4

  for (const line of [
    '2º turno (imediato) = (LULA + X₁) ÷ (LULA + X₁ + FLÁVIO) × 100',
    '2º turno (total) = (LULA + X₂) ÷ (LULA + X₂ + FLÁVIO) × 100',
    'ganho = 2º − 1º',
  ]) {
    y += PX.calcMarginTop
    setFont(ctx, 400, PX.calcSize, family)
    ctx.fillStyle = COLORS.ink
    ctx.fillText(line, left, y)
    y += PX.calcSize * PX.calcLineHeight
  }

  y += PX.legendMarginTop
  drawHairline(ctx, y, left, right)
  y += PX.legendPaddingTop
  drawWrapped(
    ctx,
    richWords(
      [
        { text: 'X₁', weight: 600, color: COLORS.ink },
        { text: ' = nulos + brancos + votos de terceiros  ·  ' },
        { text: 'X₂', weight: 600, color: COLORS.ink },
        { text: ' = X₁ + faltantes' },
      ],
      COLORS.legend,
    ),
    left,
    y,
    maxWidth,
    PX.legendSize,
    PX.legendLineHeight,
    family,
  )

  const linkTop = STORY_HEIGHT - PX.padBottom - PX.linkHeight
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = COLORS.linkBorder
  ctx.lineWidth = PX.hairline
  ctx.setLineDash([8, 8])
  ctx.roundRect(left, linkTop, maxWidth, PX.linkHeight, PX.linkRadius)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}
