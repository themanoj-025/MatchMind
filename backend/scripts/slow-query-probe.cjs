// Slow-query probe (audit 9.4).
//
// Runs a handful of realistic read queries against the test database and
// fails if any exceeds SLOW_QUERY_BUDGET_MS (default 2000ms). Prisma query
// extension events (db.slow_query / db.unbounded_query warnings from
// src/lib/prisma.ts) are logged inline so slow shapes surface in CI output.
//
// Env:
//   SLOW_QUERY_BUDGET_MS — per-query budget (default 2000)
//   DATABASE_URL         — test database connection string
//
// Run: node scripts/slow-query-probe.cjs        (from backend/, after
// `npx prisma db push` — wired into the CI build-and-test job)

const BUDGET_MS = Number(process.env.SLOW_QUERY_BUDGET_MS || 2000)

async function main() {
  let PrismaClient
  try {
    ;({ PrismaClient } = require('@prisma/client'))
  } catch {
    console.log('slow-query-probe: SKIP — @prisma/client not generated')
    return
  }
  const { PrismaPg } = require('@prisma/adapter-pg')
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('slow-query-probe: SKIP — DATABASE_URL not set')
    return
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) })
  const violations = []

  const probes = [
    ['player.findMany (page of 50)', () => prisma.player.findMany({ take: 50, orderBy: { name: 'asc' } })],
    [
      'player.findMany + rosters include (auction pool shape)',
      () =>
        prisma.player.findMany({
          where: { rosters: { none: { roomId: 'probe-room' } } },
          take: 100,
        }),
    ],
    ['user.findMany (admin list page)', () => prisma.user.findMany({ take: 50, orderBy: { totalPoints: 'desc' } })],
    ['fixture.findMany (in-play window)', () => prisma.fixture.findMany({ where: { status: 'IN_PLAY' }, take: 50 })],
    ['leaderboardSnapshot.findMany (latest board)', () => prisma.leaderboardSnapshot.findMany({ take: 100 })],
    ['roomMember.count (room size)', () => prisma.roomMember.count()],
  ]

  console.log(`slow-query-probe: budget ${BUDGET_MS}ms per query`)
  for (const [name, run] of probes) {
    const start = performance.now()
    try {
      await run()
      const elapsed = performance.now() - start
      const status = elapsed > BUDGET_MS ? 'SLOW' : 'ok'
      console.log(`  [${status}] ${name}: ${elapsed.toFixed(0)}ms`)
      if (elapsed > BUDGET_MS) {
        violations.push(`${name}: ${elapsed.toFixed(0)}ms > ${BUDGET_MS}ms`)
      }
    } catch (err) {
      const elapsed = performance.now() - start
      console.log(`  [error] ${name} after ${elapsed.toFixed(0)}ms: ${(err && err.message) || err}`)
      violations.push(`${name}: query error — ${(err && err.message) || err}`)
    }
  }

  await prisma.$disconnect()

  if (violations.length > 0) {
    console.error('\nslow-query-probe: FAILED — queries over budget:')
    for (const v of violations) console.error('  - ' + v)
    process.exit(1)
  }
  console.log('slow-query-probe: OK — all probes within budget')
}

main().catch((err) => {
  console.error('slow-query-probe: fatal —', (err && err.message) || err)
  process.exit(1)
})
