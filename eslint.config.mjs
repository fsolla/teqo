import { FlatCompat } from '@eslint/eslintrc'
import prettier from 'eslint-config-prettier/flat'
import checkFile from 'eslint-plugin-check-file'
import { globalIgnores } from 'eslint/config'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  legacyCamelCaseFilenameIgnores,
  legacyComponentFilenameIgnores,
  legacyComponentSyntaxIgnores,
  legacyFrameworkExportIgnores,
} from './eslint-legacy-ignores.mjs'
import { localRules } from './eslint-local-rules.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// eslint-config-next ships legacy (eslintrc) configs, so wrap them with
// FlatCompat to use them from this flat config with ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname })

const frameworkComponentFiles = [
  'src/app/**/{page,layout,loading,error,not-found,template,default,global-error}.tsx',
]

// `as never` silences every type check on the expression (worse than `any`).
// Fix the types instead; a justified eslint-disable comment is the only
// sanctioned escape hatch.
const noAsNeverCast = {
  selector: 'TSAsExpression > TSNeverKeyword',
  message:
    'Do not cast with `as never` — it disables type checking entirely. Fix the types or use a narrowly-typed helper.',
}

// Consent documents are resolved by stable key, never by hardcoded id (ids
// differ per environment and the lookup must fail closed). History:
// `consent: 2` shipped in submitWhatsapp and needed a data migration
// (20260725_170000) to untangle. Source-only: tests legitimately forge
// numeric consent ids to prove schemas strip mass-assigned fields.
const noHardcodedConsentId = {
  selector: "Property[key.name='consent'][value.type='Literal'][value.raw=/^[0-9]+$/]",
  message:
    'Never hardcode a Consent document id — resolve it by stable key via requireConsentByKey (keys in src/lib/campaignConsentKeys.ts).',
}

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.tsx'],
    ignores: [
      ...frameworkComponentFiles,
      ...legacyComponentFilenameIgnores,
      ...legacyFrameworkExportIgnores,
      ...legacyComponentSyntaxIgnores,
    ],
    plugins: {
      'check-file': checkFile,
      local: localRules,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*.tsx': 'PASCAL_CASE',
        },
      ],
      'local/component-arrow-conventions': 'error',
      'local/no-component-default-export': 'error',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],
    },
  },
  {
    files: frameworkComponentFiles,
    ignores: legacyFrameworkExportIgnores,
    plugins: {
      'check-file': checkFile,
      local: localRules,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*.tsx': '@(page|layout|loading|error|not-found|template|default|global-error)',
        },
      ],
      'local/framework-default-export': 'error',
      'react/function-component-definition': 'off',
    },
  },
  {
    files: [
      'src/components/**/*.{js,ts}',
      'src/lib/**/*.{js,ts}',
      'src/utilities/**/*.{js,ts}',
      'tests/**/*.{js,jsx,ts,tsx}',
    ],
    ignores: legacyCamelCaseFilenameIgnores,
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*.{js,jsx,ts,tsx}': 'CAMEL_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
    },
  },
  {
    // src/lib is the pure, client-safe layer (docs/ARCHITECTURE.md): it must
    // never depend on Payload/Next server code, on utilities/, or on higher
    // layers. Sharing types across the boundary is always fine.
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/utilities/**', '@/components/**', '@/app/**'],
              message:
                'src/lib is the pure layer — it must not depend on utilities/components/app. Move the pure logic into lib/ or this module into utilities/.',
              allowTypeImports: true,
            },
            {
              group: ['payload', 'payload/**', '@payload-config', 'next', 'next/**'],
              message:
                'src/lib must stay Payload/Next-free. Server-coupled code lives in src/utilities (marked server-only).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    // Underscore-prefixed bindings are deliberate placeholders (unused action
    // state, ignored tuple slots); everything else unused is dead code.
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-syntax': ['error', noAsNeverCast],
    },
  },
  {
    // Catch Next.js invalid-use-server-value before `next build` (Vercel).
    // MUST come after the global no-restricted-syntax block: for the same
    // rule, the last matching config object wins wholesale, so this src-only
    // widening (as-never + consent-id ban) would otherwise be overridden.
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      local: localRules,
    },
    rules: {
      'local/use-server-async-exports': 'error',
      'no-restricted-syntax': ['error', noAsNeverCast, noHardcodedConsentId],
    },
  },
  {
    // Payload generates migration signatures with unused destructured args.
    files: ['src/migrations/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Playwright artifacts (generated on e2e failures/reports):
    'playwright-report/**',
    'test-results/**',
  ]),
]

export default eslintConfig
