import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToastContainer } from './ToastContainer'
import { useToastStore } from '../store/useToastStore'

vi.mock('../store/useToastStore', () => ({
  useToastStore: vi.fn(),
}))

describe('ToastContainer', () => {
  it('renders nothing when there are no toasts', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    const { container } = render(<ToastContainer />)
    expect(container.innerHTML).toBe('')
  })

  it('renders toast messages', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [
        { id: '1', message: 'Success!', type: 'success' },
        { id: '2', message: 'Error occurred', type: 'error' },
      ],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    render(<ToastContainer />)
    expect(screen.getByText('Success!')).toBeInTheDocument()
    expect(screen.getByText('Error occurred')).toBeInTheDocument()
  })

  it('applies success styling to success toasts', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [{ id: '1', message: 'Done', type: 'success' }],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    const { container } = render(<ToastContainer />)
    const toast = container.querySelector('.bg-emerald-500\\/20')
    expect(toast).toBeTruthy()
  })

  it('applies error styling to error toasts', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [{ id: '1', message: 'Oops', type: 'error' }],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    const { container } = render(<ToastContainer />)
    const toast = container.querySelector('.bg-rose-500\\/20')
    expect(toast).toBeTruthy()
  })

  it('applies info styling to info toasts', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [{ id: '1', message: 'FYI', type: 'info' }],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    const { container } = render(<ToastContainer />)
    const toast = container.querySelector('.bg-indigo-500\\/20')
    expect(toast).toBeTruthy()
  })

  it('uses toast id as key', () => {
    vi.mocked(useToastStore).mockReturnValue({
      toasts: [{ id: 'abc-123', message: 'Keyed', type: 'info' }],
      showToast: vi.fn(),
      removeToast: vi.fn(),
    })

    render(<ToastContainer />)
    expect(screen.getByText('Keyed')).toBeInTheDocument()
  })
})
