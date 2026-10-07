import { canvasToPngBlob, downloadBlob } from '@/components/cards/cardCanvas'
import {
  drawSectionStory,
  STORY_HEIGHT,
  STORY_WIDTH,
  type SectionStoryInput,
} from '@/lib/sectionStoryRender'

/**
 * S46 — browser adapters of the story canvas: the font gate (the renderer
 * measures with Arimo 400/500/600/700, so every weight must be loaded before
 * the first draw) and the 1080×1920 draw itself. The export helpers are the
 * card studio's (`cardCanvas`) — one PNG pipeline, not a second one.
 */

const STORY_FONT_WEIGHTS = [400, 500, 600, 700] as const

export const ensureStoryFont = async (fontFamily: string): Promise<boolean> => {
  if (typeof document === 'undefined' || !document.fonts) return false
  const primaryFamily = fontFamily.split(',')[0]?.trim() || fontFamily
  try {
    const faces = await Promise.all(
      STORY_FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 100px ${primaryFamily}`)),
    )
    return faces.every((face) => face.length > 0)
  } catch {
    return false
  }
}

export const drawStoryOnCanvas = (canvas: HTMLCanvasElement, input: SectionStoryInput): boolean => {
  canvas.width = STORY_WIDTH
  canvas.height = STORY_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return false
  drawSectionStory(context, input)
  return true
}

export { canvasToPngBlob, downloadBlob }
