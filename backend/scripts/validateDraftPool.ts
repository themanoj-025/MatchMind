/**
 * validateDraftPool.ts — MatchMind v4 §6.3
 *
 * CLI entry point for Draft Mode pool validation.
 * Delegates to the shared library in src/lib/ so that both
 * the CLI and the admin API use identical validation logic.
 *
 * Usage:
 *   npx tsx scripts/validateDraftPool.ts               # all tournaments
 *   npx tsx scripts/validateDraftPool.ts fifa-wc-2026  # single tournament
 *
 * Exit code: 0 = pass (safe to enable Draft Mode), 1 = fail (block enabling)
 */

import fs from 'fs'
import path from 'path'
import {
  validateTournamentDraftPool,
  formatValidationResult,
} from '../src/lib/validateDraftPool'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

function main() {
  const targetId = process.argv[2]
  const registryPath = path.join(
    __dirname,
    '..',
    'src',
    'config',
    'tournamentRegistry.json',
  )

  let tournamentIds: string[] = []
  if (targetId) {
    tournamentIds = [targetId]
  } else {
    if (fs.existsSync(registryPath)) {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
      tournamentIds = (registry.tournaments || []).map((t: any) => t.id)
    }
    if (tournamentIds.length === 0) {
      console.error('❌ No tournaments found in registry')
      process.exit(1)
    }
  }

  let allPassed = true

  console.log(`\n🔍 Validating Draft Mode pool readiness...\n`)

  for (const tid of tournamentIds) {
    const result = validateTournamentDraftPool(tid, DATA_DIR)
    console.log(formatValidationResult(result))
    console.log('')
    if (!result.passed) allPassed = false
  }

  console.log(`${'='.repeat(50)}`)
  if (allPassed) {
    console.log(
      '✅ Draft Mode pool validation PASSED for all checked tournaments.',
    )
    console.log('   Safe to enable the Draft Mode feature flag.')
  } else {
    console.log('❌ Draft Mode pool validation FAILED.')
    console.log(
      '   Fix errors above before enabling the DRAFT_ENABLED feature flag for these tournaments.',
    )
    console.log('   See §6.3 of v4 spec for details.')
  }

  process.exit(allPassed ? 0 : 1)
}

main()
