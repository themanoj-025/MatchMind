import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (classname merger)', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    // tailwind-merge should keep only the last p-4
    const result = cn('p-2', 'p-4')
    expect(result).toBe('p-4')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra')
    expect(result).toContain('base')
    expect(result).toContain('extra')
    expect(result).not.toContain('hidden')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles undefined and null gracefully', () => {
    const result = cn('foo', undefined, null, 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })
})
