import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CAMPAIGN_LONG_PRESS_MS, useCampaignLongPress } from '@/lib/campaignLongPress'
const LongPressHarness = ({
  onLongPress,
  onClick,
}: {
  onLongPress: () => void
  onClick?: () => void
}) => {
  const handlers = useCampaignLongPress({
    enabled: true,
    onLongPress,
    onClick,
  })
  return (
    <button type="button" {...handlers}>
      Alvo
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useCampaignLongPress', () => {
  it('calls onLongPress after the threshold and suppresses the following click', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} onClick={onClick} />)

    const target = screen.getByRole('button', { name: 'Alvo' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    act(() => {
      vi.advanceTimersByTime(CAMPAIGN_LONG_PRESS_MS)
    })
    expect(onLongPress).toHaveBeenCalledTimes(1)

    fireEvent.pointerUp(target)
    fireEvent.click(target)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick on a short tap', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} onClick={onClick} />)

    const target = screen.getByRole('button', { name: 'Alvo' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(target)
    fireEvent.click(target)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('aborts when the pointer moves beyond slop', () => {
    const onLongPress = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} />)

    const target = screen.getByRole('button', { name: 'Alvo' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(target, { clientX: 24, clientY: 0 })
    act(() => {
      vi.advanceTimersByTime(CAMPAIGN_LONG_PRESS_MS)
    })
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('clears the timer on pointercancel', () => {
    const onLongPress = vi.fn()
    render(<LongPressHarness onLongPress={onLongPress} />)

    const target = screen.getByRole('button', { name: 'Alvo' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerCancel(target)
    act(() => {
      vi.advanceTimersByTime(CAMPAIGN_LONG_PRESS_MS)
    })
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('does not call onLongPress after unmount during the hold', () => {
    const onLongPress = vi.fn()
    const { unmount } = render(<LongPressHarness onLongPress={onLongPress} />)

    const target = screen.getByRole('button', { name: 'Alvo' })
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 })
    unmount()
    act(() => {
      vi.advanceTimersByTime(CAMPAIGN_LONG_PRESS_MS)
    })
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
