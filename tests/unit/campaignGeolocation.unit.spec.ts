import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GEO_PROMPT_SESSION_KEY,
  hasPromptedThisSession,
  markPromptedThisSession,
  readGeolocationPermissionState,
  requestCurrentPosition,
} from '@/utilities/campaignGeolocation'
import { stub } from '../helpers/stub'

const defineNavigatorProperty = (property: 'geolocation' | 'permissions', value: unknown) => {
  Object.defineProperty(navigator, property, { value, configurable: true, writable: true })
}

const removeNavigatorProperty = (property: 'geolocation' | 'permissions') => {
  Reflect.deleteProperty(navigator, property)
}

const positionErrorOf = (code: number): GeolocationPositionError =>
  stub<GeolocationPositionError>({
    code,
    message: 'stub',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  })

const stubPosition = (coords: { latitude: number; longitude: number; accuracy: number }) => {
  const getCurrentPosition = vi.fn(
    (
      onSuccess: PositionCallback,
      _onError?: PositionErrorCallback | null,
      _options?: PositionOptions,
    ) =>
      void onSuccess(
        stub<GeolocationPosition>({ coords: stub<GeolocationCoordinates>(coords), timestamp: 0 }),
      ),
  )
  defineNavigatorProperty('geolocation', { getCurrentPosition })
  return getCurrentPosition
}

const stubPositionError = (code: number) => {
  defineNavigatorProperty('geolocation', {
    getCurrentPosition: (_onSuccess: PositionCallback, onError: PositionErrorCallback) =>
      void onError(positionErrorOf(code)),
  })
}

describe('campaignGeolocation', () => {
  afterEach(() => {
    sessionStorage.clear()
    removeNavigatorProperty('geolocation')
    removeNavigatorProperty('permissions')
    vi.restoreAllMocks()
  })

  describe('session prompt flag', () => {
    it('starts unset and survives within the session', () => {
      expect(hasPromptedThisSession()).toBe(false)

      markPromptedThisSession()

      expect(sessionStorage.getItem(GEO_PROMPT_SESSION_KEY)).toBe('1')
      expect(hasPromptedThisSession()).toBe(true)
    })

    it('stays silent when storage throws (private mode)', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })

      expect(hasPromptedThisSession()).toBe(true)
    })

    it('swallows write failures', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })

      expect(() => markPromptedThisSession()).not.toThrow()
    })
  })

  describe('readGeolocationPermissionState', () => {
    it('is unknown without the geolocation API', async () => {
      defineNavigatorProperty('permissions', { query: vi.fn() })

      await expect(readGeolocationPermissionState()).resolves.toBe('unknown')
    })

    it('is unknown when the Permissions API is absent (Safari)', async () => {
      stubPosition({ latitude: -12.9, longitude: -38.5, accuracy: 30 })

      await expect(readGeolocationPermissionState()).resolves.toBe('unknown')
    })

    it('reports the queried state', async () => {
      stubPosition({ latitude: -12.9, longitude: -38.5, accuracy: 30 })
      defineNavigatorProperty('permissions', {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      })

      await expect(readGeolocationPermissionState()).resolves.toBe('granted')
    })

    it('is unknown when the query rejects (unsupported descriptor)', async () => {
      stubPosition({ latitude: -12.9, longitude: -38.5, accuracy: 30 })
      defineNavigatorProperty('permissions', {
        query: vi.fn().mockRejectedValue(new TypeError('unsupported')),
      })

      await expect(readGeolocationPermissionState()).resolves.toBe('unknown')
    })
  })

  describe('requestCurrentPosition', () => {
    it('returns a fix with low accuracy requested', async () => {
      const getCurrentPosition = stubPosition({
        latitude: -12.973,
        longitude: -38.5121,
        accuracy: 42,
      })

      await expect(requestCurrentPosition()).resolves.toEqual({
        ok: true,
        fix: { lat: -12.973, lng: -38.5121, accuracyM: 42 },
      })
      expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ enableHighAccuracy: false })
    })

    it('reports an unsupported browser instead of throwing', async () => {
      await expect(requestCurrentPosition()).resolves.toEqual({ ok: false, reason: 'unsupported' })
    })

    it.each([
      [1, 'denied'],
      [2, 'unavailable'],
      [3, 'timeout'],
    ])('maps error code %i to %s', async (code, reason) => {
      stubPositionError(code)

      await expect(requestCurrentPosition()).resolves.toEqual({ ok: false, reason })
    })
  })
})
