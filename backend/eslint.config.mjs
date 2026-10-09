import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'scripts', 'src/data'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        node: true,
        es2022: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Discourage `as any` — use proper types or `unknown`. Set to error once all 58 casts are eliminated.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow console.log — replaced by Pino, but fallback OK
      'no-console': 'off',

      // Require === and !==
      eqeqeq: ['warn', 'always', { null: 'ignore' }],

      // No unused vars (exceptions for _ prefixed)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Prefer const over let when not reassigned
      'prefer-const': 'warn',

      // No var
      'no-var': 'warn',

      // Disable no-undef for TypeScript
      'no-undef': 'off',
      'no-redeclare': 'off',
      'preserve-caught-error': 'off',

      // No duplicate imports
      'no-duplicate-imports': 'warn',

      // Require curly braces even for single-line blocks
      curly: ['warn', 'all'],

      // No trailing spaces
      'no-trailing-spaces': 'warn',

      // Consistent return
      'consistent-return': 'warn',

      // Cyclomatic complexity — flag functions over 10 branches
      complexity: ['warn', 10],

      // Max lines per function — flag God functions
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],

      // Max params — prevents excessive coupling
      'max-params': ['warn', 5],

      // Audit 9.2: zod's throwing `.parse()` must not run on untrusted
      // request data — an invalid payload would surface as an unhandled
      // ZodError (HTTP 500) instead of a 400. Use `.safeParse()` + explicit
      // handling (see src/middleware/validate.ts for the canonical pattern).
      // Build-time config loads that intentionally fail fast are exempted
      // per-file below; src/config/no-raw-parse.cjs is the CI enforcement.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "MemberExpression[object.name=/Schema$/][property.name='parse']",
          message:
            'Use `.safeParse()` on untrusted input; throwing `.parse()` turns malformed data into an unhandled ZodError (HTTP 500).',
        },
      ],
    },
  },
  {
    // Test files contain long setup/assertion scenarios by nature —
    // exempt them from max-lines-per-function only (complexity still applies).
    files: ['**/*.test.ts', '**/e2e/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    // Audit 9.2: intentional fail-fast parse on a build-time registry file
    // (throw is caught in-module → process.exit(1)). See src/config/tournaments.ts.
    files: ['src/config/tournaments.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
)
