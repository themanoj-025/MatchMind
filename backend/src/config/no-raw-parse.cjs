// CI-blocking guard (audit 9.2): production code must not call zod's
// throwing `.parse()` on untrusted input — use `.safeParse()` and handle
// the failure explicitly. A raw `.parse()` on request data turns malformed
// input into an unhandled ZodError (HTTP 500) instead of a 400.
//
// Allowlist (never remove an entry without replacing the parse with
// safeParse or routing it through the throwing-but-intentional wrapper):
//   - src/config/tournaments.ts — intentional fail-fast on a build-time
//     registry file (throw inside try/catch, then process.exit(1))
//   - test files: *.test.ts, *.spec.ts, __tests__ folders, e2e folders,
//     and src/test-utils shared helpers
//   - JSON.parse is unaffected: this only flags the zod pattern
//     `.parse(` directly following a schema-like expression
//     (heuristic: `Schema.parse(` / `schema.parse(` / `).parse(`).
//
// Run: node src/config/no-raw-parse.cjs   (exit 1 on violations)
// Wired into `npm run lint` (backend) and CI (backend-quality job).
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const SCAN_DIRS = [path.join(ROOT, 'src')]
const ALLOW_GLOBS = [
  /(^|\/|\\)__tests__(\/|\\)/, // unit test folders
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /(^|\/|\\)e2e(\/|\\)/, // end-to-end suites
  /(^|\/|\\)test-utils(\/|\\)/, // shared test helpers
]
// Files where a throwing parse is deliberate and documented
const ALLOW_FILES = new Set([path.join(ROOT, 'src', 'config', 'tournaments.ts')])

// Matches zod-style parse calls: `fooSchema.parse(`, `schema.parse(`,
// `buildSchema(x).parse(` — i.e. `.parse(` where the receiver is not a
// literal (JSON.parse etc. are excluded by requiring a lowercase/identifier
// receiver ending in Schema/schema, or a `)` before `.parse(`).
const ZOD_PARSE = /(?:[A-Za-z_$][\w$]*[Ss]chema|[)\]])\s*\.parse\s*\(/

function listTsFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full))
    } else if (/\.(ts|mts|cts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const violations = []
for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of listTsFiles(dir)) {
    const rel = path.relative(ROOT, file)
    if (ALLOW_FILES.has(file)) continue
    if (ALLOW_GLOBS.some((re) => re.test(rel))) continue
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const stripped = line.replace(/\/\/.*$/, '') // drop line comments
      if (ZOD_PARSE.test(stripped)) {
        violations.push(`${rel}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (violations.length > 0) {
  console.error(
    [
      'no-raw-parse: zod `.parse()` found in production code — use `.safeParse()`',
      'and handle the failure explicitly (see the header of this script).',
      '',
      ...violations.map((v) => '  ' + v),
      '',
      `${violations.length} violation(s).`,
    ].join('\n'),
  )
  process.exit(1)
}
console.log('no-raw-parse: OK — no zod .parse() on untrusted input in production code')
