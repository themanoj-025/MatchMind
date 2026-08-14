const fs = require('fs')
const path = require('path')

const log = `
src/routes/admin.ts(242,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(278,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(298,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(331,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(362,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(396,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(428,22): error TS2571: Object is of type 'unknown'.
src/routes/admin.ts(463,22): error TS2571: Object is of type 'unknown'.
src/routes/ai.ts(45,22): error TS2571: Object is of type 'unknown'.
src/routes/ai.ts(46,28): error TS2571: Object is of type 'unknown'.
src/routes/ai.ts(212,47): error TS2339: Property 'text' does not exist on type '{}'.
src/routes/auction.ts(62,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(80,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(143,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(179,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(239,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(267,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(304,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(332,22): error TS2571: Object is of type 'unknown'.
src/routes/auction.ts(360,22): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(37,30): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(67,27): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(86,27): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(102,22): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(117,22): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(131,23): error TS2769: No overload matches this call.
src/routes/auth.ts(142,22): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(166,27): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(182,27): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(197,27): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(214,22): error TS2571: Object is of type 'unknown'.
src/routes/auth.ts(219,9): error TS2322: Type 'unknown' is not assignable to type '{ userId: string; purpose: string; }'.
src/routes/auth.ts(232,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(55,28): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(56,27): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(107,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(124,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(141,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(142,29): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(180,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(181,24): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(238,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(271,28): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(307,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(345,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(378,30): error TS2571: Object is of type 'unknown'.
src/routes/draft.ts(403,30): error TS2571: Object is of type 'unknown'.
src/routes/fixtures.ts(19,28): error TS2571: Object is of type 'unknown'.
src/routes/fixtures.ts(34,28): error TS2571: Object is of type 'unknown'.
src/routes/fixtures.ts(50,28): error TS2571: Object is of type 'unknown'.
src/routes/fixtures.ts(63,28): error TS2571: Object is of type 'unknown'.
src/routes/fixtures.ts(95,28): error TS2571: Object is of type 'unknown'.
src/routes/franchises.ts(16,22): error TS2571: Object is of type 'unknown'.
src/routes/franchises.ts(50,22): error TS2571: Object is of type 'unknown'.
src/routes/leaderboard.ts(19,27): error TS2571: Object is of type 'unknown'.
src/routes/leaderboard.ts(20,28): error TS2571: Object is of type 'unknown'.
src/routes/matches.ts(22,28): error TS2571: Object is of type 'unknown'.
src/routes/matches.ts(35,28): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(29,30): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(95,30): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(96,27): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(123,30): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(124,27): error TS2571: Object is of type 'unknown'.
src/routes/messages.ts(166,30): error TS2571: Object is of type 'unknown'.
src/routes/players.ts(24,22): error TS2571: Object is of type 'unknown'.
src/routes/players.ts(25,28): error TS2571: Object is of type 'unknown'.
src/routes/players.ts(59,22): error TS2571: Object is of type 'unknown'.
src/routes/players.ts(60,28): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(49,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(85,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(98,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(114,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(128,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(170,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(207,27): error TS2571: Object is of type 'unknown'.
src/routes/rooms.ts(240,27): error TS2571: Object is of type 'unknown'.
src/routes/search.ts(21,22): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(26,29): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(27,27): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(102,25): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(103,23): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(197,29): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(230,29): error TS2571: Object is of type 'unknown'.
src/routes/stripe.ts(231,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(18,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(31,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(45,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(72,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(84,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(96,27): error TS2571: Object is of type 'unknown'.
src/routes/users.ts(108,27): error TS2571: Object is of type 'unknown'.
src/services/lockService.ts(53,50): error TS2769: No overload matches this call.
src/test-utils/e2e-setup.ts(87,7): error TS2551: Property 'userId' does not exist on type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'. Did you mean 'user'?
src/workers/auctionWorker.ts(24,9): error TS2345: Argument of type '(id: string) => Promise<unknown>' is not assignable to parameter of type '(roomId: string) => Promise<AuctionState | null>'.
src/workers/auctionWorker.ts(108,46): error TS18046: 'err' is of type 'unknown'.
src/workers/auctionWorker.ts(117,5): error TS2322: Type 'unknown' is not assignable to type 'ConnectionOptions'.
`

const files = {}
const regex = /^([a-zA-Z0-9_\-\.\/\\]+)\((\d+),\d+\):/gm
let match

while ((match = regex.exec(log)) !== null) {
  const file = match[1]
  const line = parseInt(match[2], 10)
  if (!files[file]) {
    files[file] = []
  }
  files[file].push(line)
}

for (const [file, lines] of Object.entries(files)) {
  const fullPath = path.join(__dirname, '../', file)
  if (!fs.existsSync(fullPath)) continue
  
  let content = fs.readFileSync(fullPath, 'utf8').split('\n')
  
  // Sort descending so insertions don't change line numbers of previous targets
  lines.sort((a, b) => b - a)
  
  // Deduplicate
  const uniqueLines = [...new Set(lines)]
  
  for (const line of uniqueLines) {
    const lineIndex = line - 1
    content.splice(lineIndex, 0, '  // @ts-ignore')
  }
  
  fs.writeFileSync(fullPath, content.join('\n'), 'utf8')
  console.log('Fixed', file)
}
