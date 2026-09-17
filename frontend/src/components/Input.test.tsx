import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('accepts typed text', async () => {
    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')
    await userEvent.type(input, 'hello')
    expect(input).toHaveValue('hello')
  })

  it('can be disabled', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('passes through custom props', () => {
    render(<Input type="email" data-testid="email-input" />)
    expect(screen.getByTestId('email-input')).toHaveAttribute('type', 'email')
  })

  it('calls onChange handler', async () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })
})
