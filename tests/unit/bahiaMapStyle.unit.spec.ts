import { describe, expect, it } from 'vitest'

import {
  buildLayerStyleContext,
  canonicalMapKeysKey,
  computeChoroplethMax,
  featureMapKey,
  resolvePathStyle,
} from '@/lib/bahiaMapStyle'

describe('bahiaMapStyle', () => {
  const baseContext = buildLayerStyleContext({
    values: { '2927408': 500, '2905701': 200 },
    fillMode: 'sequential',
    highlightKey: '',
    selectedKey: null,
  })

  describe('computeChoroplethMax', () => {
    it('uses scaleMax when provided', () => {
      expect(computeChoroplethMax({ '2927408': 999 }, 'sequential', 1)).toBe(1)
    })

    it('derives max from positive values in sequential mode', () => {
      expect(computeChoroplethMax({ '2927408': 100, '2905701': 300 }, 'sequential')).toBe(300)
    })

    it('uses absolute max in diverging mode', () => {
      expect(computeChoroplethMax({ '2927408': -40, '2905701': 100 }, 'diverging')).toBe(100)
    })
  })

  describe('featureMapKey (B8 F2)', () => {
    it('keys a zone municipality by its slug, never by the city code it also carries', () => {
      expect(featureMapKey({ municipalitySlug: 'salvador-ze-7', ibgeCode: '2927408' })).toBe(
        'salvador-ze-7',
      )
    })

    it('keys a município by codarea and an identity territory by code', () => {
      expect(featureMapKey({ codarea: '2905701', name: 'Barreiras' })).toBe('2905701')
      expect(featureMapKey({ code: 'chapada-diamantina', name: 'Chapada Diamantina' })).toBe(
        'chapada-diamantina',
      )
    })

    it('returns undefined when no key property is usable', () => {
      expect(featureMapKey(undefined)).toBeUndefined()
      expect(featureMapKey({ name: 'Sem chave' })).toBeUndefined()
      expect(featureMapKey({ codarea: '' })).toBeUndefined()
      expect(featureMapKey({ codarea: 2905701 })).toBeUndefined()
    })
  })

  describe('canonicalMapKeysKey', () => {
    it('sorts keys for stable identity', () => {
      expect(canonicalMapKeysKey(['2927408', '2905701'])).toBe('2905701,2927408')
      expect(canonicalMapKeysKey(['2905701', '2927408'])).toBe('2905701,2927408')
    })

    it('returns empty string for empty input', () => {
      expect(canonicalMapKeysKey([])).toBe('')
    })
  })

  describe('resolvePathStyle', () => {
    it('highlights hovered feature over selected', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: '2927408',
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(2)
      expect(resolvePathStyle(context, '2905701').weight).toBe(1)
    })

    it('highlights selected feature when not hovering', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: null,
      }

      expect(resolvePathStyle(context, '2905701').weight).toBe(2)
    })

    it('reveals selected highlight after hover clears on a different feature', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: null,
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(1)
      expect(resolvePathStyle(context, '2905701').weight).toBe(2)
    })

    it('highlights keys in highlightSet', () => {
      const context = {
        ...baseContext,
        highlightSet: new Set(['2927408']),
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(2)
    })

    it('keeps fillOpacity when highlighted', () => {
      const base = resolvePathStyle(baseContext, '2927408')
      const highlighted = resolvePathStyle({ ...baseContext, hoveredKey: '2927408' }, '2927408')

      expect(highlighted.fillOpacity).toBe(base.fillOpacity)
      expect(highlighted.color).toBe('#c51414')
    })

    it('uses diverging fill for negative metrics', () => {
      const context = buildLayerStyleContext({
        values: { '2927408': -100 },
        fillMode: 'diverging',
        scaleMax: 200,
        highlightKey: '',
        selectedKey: null,
      })

      expect(resolvePathStyle(context, '2927408').fillColor).toMatch(/^rgb\(/)
    })

    it('returns neutral style for missing feature key', () => {
      const style = resolvePathStyle(baseContext, '')
      expect(style.fillOpacity).toBe(0.35)
      expect(style.weight).toBe(1)
    })
  })

  describe('discrete class fills (B13)', () => {
    const classedContext = buildLayerStyleContext({
      values: { '2927408': 500, '2905701': 200, '2910800': 0 },
      fillMode: 'sequential',
      fillByKey: { '2927408': '#111111', '2905701': '#eeeeee' },
      highlightKey: '',
      selectedKey: null,
    })

    it('paints the class fill instead of the continuous ramp', () => {
      expect(resolvePathStyle(classedContext, '2927408').fillColor).toBe('#111111')
      expect(resolvePathStyle(classedContext, '2905701').fillColor).toBe('#eeeeee')
    })

    it('renders a key without a class as no data, even when it has a value', () => {
      const style = resolvePathStyle(classedContext, '2910800')
      expect(style.fillColor).toBe('#f4f4f5')
      expect(style.fillOpacity).toBe(0.35)
    })

    it('still highlights hover and selection', () => {
      const style = resolvePathStyle({ ...classedContext, hoveredKey: '2927408' }, '2927408')
      expect(style.weight).toBe(2)
      expect(style.fillColor).toBe('#111111')
    })
  })
})
