import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GlobalSpinner } from './GlobalSpinner'

describe('GlobalSpinner', () => {
  it('renders a loading spinner', () => {
    const { container } = render(<GlobalSpinner />)
    // The component uses Loader2 from lucide-react which renders as an SVG with aria-hidden
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(spinner?.tagName.toLowerCase()).toBe('svg')
  })

  it('fills the full viewport', () => {
    const { container } = render(<GlobalSpinner />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-screen')
    expect(wrapper.className).toContain('w-full')
  })
})
