import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation.js', () => ({ useRouter: () => router }))

const livePreview = vi.hoisted(() => ({ mounts: 0 }))

vi.mock('@payloadcms/live-preview-react', () => ({
  RefreshRouteOnSave: ({ refresh }: { refresh: () => void }) => {
    livePreview.mounts += 1
    refresh()
    return null
  },
}))

import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'

const setParentWindow = (value: Window) => {
  Object.defineProperty(window, 'parent', { configurable: true, value })
}

afterEach(() => {
  cleanup()
  setParentWindow(window)
})

beforeEach(() => {
  router.refresh.mockReset()
  livePreview.mounts = 0
})

describe('RefreshRouteOnSave', () => {
  it('does not mount the preview bridge (nor refresh) on a standalone public load', () => {
    render(<RefreshRouteOnSave />)

    expect(livePreview.mounts).toBe(0)
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('mounts the bridge and refreshes inside the admin preview iframe', () => {
    setParentWindow({} as Window)

    render(<RefreshRouteOnSave />)

    expect(livePreview.mounts).toBe(1)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })
})
