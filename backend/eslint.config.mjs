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
    },
  },
)
