import { defineConfig } from '@prisma/config'

// Prisma 7: the schema deliberately omits a datasource url; CLI commands
// (db push / migrate) take it from this config. It must be the TOP-LEVEL
// `datasource.url` — nesting it under `migrate.connection` silently leaves
// it unset and fails with "The datasource.url property is required".
// (Fixed for audit 9: CI's build-and-test job could not push the schema.)
export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
