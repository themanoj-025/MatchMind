import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToastStore } from './useToastStore'

beforeEach(() => {
  // Reset the store between tests
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToastStore', () => {
  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('showToast adds a toast with default type "info"', () => {
    const { showToast } = useToastStore.getState()
    showToast('Hello world')

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Hello world')
    expect(toasts[0].type).toBe('info')
    expect(toasts[0].id).toBeTruthy()
  })

  it('showToast accepts custom type', () => {
    const { showToast } = useToastStore.getState()
    showToast('Error occurred', 'error')

    const { toasts } = useToastStore.getState()
    expect(toasts[0].type).toBe('error')
  })

  it('showToast accepts success type', () => {
    const { showToast } = useToastStore.getState()
    showToast('Done!', 'success')

    expect(useToastStore.getState().toasts[0].type).toBe('success')
  })

  it('removes toast after 4 seconds', () => {
    const { showToast } = useToastStore.getState()
    showToast('Auto-remove')

    expect(useToastStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(4000)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('removeToast removes a specific toast by id', () => {
    const { showToast } = useToastStore.getState()
    showToast('First')
    showToast('Second')

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(2)

    const firstId = toasts[0].id
    useToastStore.getState().removeToast(firstId)

    const remaining = useToastStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].message).toBe('Second')
  })

  it('can add multiple toasts', () => {
    const { showToast } = useToastStore.getState()
    showToast('One')
    showToast('Two')
    showToast('Three')

    expect(useToastStore.getState().toasts).toHaveLength(3)
  })
})
