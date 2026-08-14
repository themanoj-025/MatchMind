const fs = require('fs')
const path = require('path')

const appTsPath = path.join(__dirname, '../src/app.ts')
let content = fs.readFileSync(appTsPath, 'utf8')

// Remove asyncHandler from app.ts
content = content.replace("import asyncHandler from './middleware/asyncHandler'\n", '')
content = content.replace("asyncHandler(async (_req: express.Request, res: express.Response) => {", "async (_req: express.Request, res: express.Response) => {")
content = content.replace("  }),\n)", "  }\n)")

// Version APIs
content = content.replace(/app\.use\('\/api\/auth/g, "app.use('/api/v1/auth")
content = content.replace(/app\.use\('\/api\/tournaments/g, "app.use('/api/v1/tournaments")
content = content.replace(/app\.use\('\/api\/players/g, "app.use('/api/v1/players")
content = content.replace(/app\.use\('\/api\/rooms/g, "app.use('/api/v1/rooms")
content = content.replace(/app\.use\('\/api\/fixtures/g, "app.use('/api/v1/fixtures")
content = content.replace(/app\.use\('\/api\/leaderboard/g, "app.use('/api/v1/leaderboard")
content = content.replace(/app\.use\('\/api\/users/g, "app.use('/api/v1/users")
content = content.replace(/app\.use\('\/api\/messages/g, "app.use('/api/v1/messages")
content = content.replace(/app\.use\('\/api\/search/g, "app.use('/api/v1/search")
content = content.replace(/app\.use\('\/api\/admin/g, "app.use('/api/v1/admin")
content = content.replace(/app\.use\('\/api\/stripe(?!.*webhook)/g, "app.use('/api/v1/stripe")
content = content.replace(/app\.use\('\/api\/ai/g, "app.use('/api/v1/ai")
content = content.replace(/app\.use\('\/api\/draft/g, "app.use('/api/v1/draft")

fs.writeFileSync(appTsPath, content, 'utf8')
console.log('Fixed app.ts')
