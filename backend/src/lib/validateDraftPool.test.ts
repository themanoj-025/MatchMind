import { describe, it, expect } from 'vitest'
import { formatValidationResult, type ValidationResult } from './validateDraftPool'

describe('formatValidationResult', () => {
  it('formats a passing result', () => {
    const result: ValidationResult = {
      tournamentId: 'test-tournament',
      passed: true,
      errors: [],
      warnings: [],
      infos: ['Photo URL completeness: 100% ✅'],
    }
    const output = formatValidationResult(result)
    expect(output).toContain('PASS')
    expect(output).toContain('test-tournament')
    expect(output).toContain('Photo URL completeness: 100% ✅')
  })

  it('formats a failing result with errors', () => {
    const result: ValidationResult = {
      tournamentId: 'bad-tournament',
      passed: false,
      errors: ['Missing basePrice for 3 players'],
      warnings: ['Low photo coverage'],
      infos: [],
    }
    const output = formatValidationResult(result)
    expect(output).toContain('FAIL')
    expect(output).toContain('bad-tournament')
    expect(output).toContain('Missing basePrice for 3 players')
    expect(output).toContain('Low photo coverage')
  })

  it('formats result with no issues', () => {
    const result: ValidationResult = {
      tournamentId: 'clean-tournament',
      passed: true,
      errors: [],
      warnings: [],
      infos: [],
    }
    const output = formatValidationResult(result)
    expect(output).toContain('All checks passed')
  })

  it('formats multiple errors and warnings', () => {
    const result: ValidationResult = {
      tournamentId: 'multi',
      passed: false,
      errors: ['Error 1', 'Error 2', 'Error 3'],
      warnings: ['Warning 1'],
      infos: ['Info 1'],
    }
    const output = formatValidationResult(result)
    expect(output).toContain('Error 1')
    expect(output).toContain('Error 2')
    expect(output).toContain('Error 3')
    expect(output).toContain('Warning 1')
    expect(output).toContain('Info 1')
  })
})
