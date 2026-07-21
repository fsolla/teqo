import { FlatCompat } from '@eslint/eslintrc'
import prettier from 'eslint-config-prettier/flat'
import checkFile from 'eslint-plugin-check-file'
import { globalIgnores } from 'eslint/config'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { localRules } from './eslint-local-rules.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// eslint-config-next ships legacy (eslintrc) configs, so wrap them with
// FlatCompat to use them from this flat config with ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname })

const frameworkComponentFiles = [
  'src/app/**/{page,layout,loading,error,not-found,template,default,global-error}.tsx',
]

// These predate the naming convention. Keep them linted by Next's rules while
// requiring new component files to use PascalCase.
const legacyComponentFilenameIgnores = [
  'src/components/campaign/campaign-logo.tsx',
  'src/components/socialIcons.tsx',
  'src/components/socialLinks.tsx',
  'src/components/ui/breadcrumb.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/card.tsx',
  'src/components/ui/combobox.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/field.tsx',
  'src/components/ui/input-group.tsx',
  'src/components/ui/input.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/native-select.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/separator.tsx',
  'src/components/ui/skeleton.tsx',
  'src/components/ui/textarea.tsx',
  'src/components/ui/tooltip.tsx',
]

const legacyFrameworkExportIgnores = [
  'src/app/(payload)/admin/\\[\\[...segments\\]\\]/not-found.tsx',
  'src/app/(payload)/admin/\\[\\[...segments\\]\\]/page.tsx',
  'src/app/(payload)/layout.tsx',
]

const legacyComponentSyntaxIgnores = [
  'src/components/StateSelect.tsx',
  'src/components/ThemeProvider.tsx',
]

const legacyCamelCaseFilenameIgnores = [
  'src/lib/schemas/campaign-login.ts',
  'src/lib/schemas/petition-form.ts',
  'src/lib/schemas/whatsapp-form.ts',
  'tests/int/petition-page-layout.int.spec.ts',
]

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
    // Catch Next.js invalid-use-server-value before `next build` (Vercel).
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      local: localRules,
    },
    rules: {
      'local/use-server-async-exports': 'error',
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
  ]),
]

export default eslintConfig
