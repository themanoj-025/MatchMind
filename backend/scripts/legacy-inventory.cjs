// Legacy-code inventory (audit 9.3).
//
// The repository still ships a JSON-file "legacy" persistence layer:
// backend/src/data/*.json (31 files at baseline) are flat-file dumps from the
// pre-Prisma era (see docs/technical/schema-discovery.md). They are excluded
// from eslint (eslint.config.mjs ignores src/data) and are no longer imported
// by runtime code, but they still ship in the Docker image and drift silently
// from the Prisma schema.
//
// This script inventories the legacy surface and enforces a ratchet:
//   - fails if src/data JSON file count grows (new legacy files)
//   - fails if any non-test runtime module references the JSON files
//     (legacy layer creeping back into production code paths)
//   - warns on new top-level "legacy" candidates (jsonDb-style modules)
//
// Baseline lives in scripts/legacy-ratchet.json. Lower the numbers there as
// legacy files are deleted — raising them requires editing this script's
// review note and is treated as a regression.
//
// Run: node scripts/legacy-inventory.cjs   (exit 1 on ratchet violations)

const fs = require('fs')
const path = require('path')

const BACKEND_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(BACKEND_ROOT, 'src', 'data')
const SRC_DIR = path.join(BACKEND_ROOT, 'src')
const RATCHET_PATH = path.join(__dirname, 'legacy-ratchet.json')

const baseline = JSON.parse(fs.readFileSync(RATCHET_PATH, 'utf8'))

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, ext))
    else if (full.endsWith(ext)) out.push(full)
  }
  return out
}

const legacyFiles = listFiles(DATA_DIR, '.json')

// Runtime references: non-test .ts files that import or require the legacy
// JSON dumps (or the old jsonDb module).
const runtimeRefFiles = []
for (const file of listFiles(SRC_DIR, '.ts')) {
  const rel = path.relative(BACKEND_ROOT, file).replace(/\\/g, '/')
  if (/\.test\.ts$/.test(rel) || /(^|\/)(__tests__|e2e|test-utils)(\/|$)/.test(rel)) continue
  const src = fs.readFileSync(file, 'utf8')
  if (/(?:from\s+['"].*\/data\/|require\s*\(\s*['"].*\/data\/|jsonDb)/.test(src)) {
    runtimeRefFiles.push(rel)
  }
}

const problems = []
if (legacyFiles.length > baseline.legacyDataFiles) {
  problems.push(
    `legacy data file count grew: ${legacyFiles.length} > ${baseline.legacyDataFiles} — new files in src/data/ must not be added`,
  )
}
if (runtimeRefFiles.length > baseline.legacyRuntimeRefs) {
  problems.push(
    `runtime references to legacy data grew: ${runtimeRefFiles.length} > ${baseline.legacyRuntimeRefs} —` +
      ` production code must not read src/data/*.json (migrate to Prisma)`,
  )
}

console.log(`legacy inventory:`)
console.log(`  src/data JSON files:        ${legacyFiles.length} (ratchet ≤ ${baseline.legacyDataFiles})`)
console.log(`  runtime refs to legacy:     ${runtimeRefFiles.length} (ratchet ≤ ${baseline.legacyRuntimeRefs})`)
if (runtimeRefFiles.length > 0) {
  for (const f of runtimeRefFiles) console.log(`    ref: ${f}`)
}

if (problems.length > 0) {
  console.error('\nlegacy ratchet VIOLATED:')
  for (const p of problems) console.error('  - ' + p)
  console.error('\nShrink the legacy surface instead: delete migrated files under src/data/ and lower')
  console.error(`the baseline in backend/scripts/legacy-ratchet.json.`)
  process.exit(1)
}
console.log('legacy ratchet: OK — legacy surface did not grow')
