// Files that predate a naming/syntax convention and are deliberately exempt
// from it. Consumed by eslint.config.mjs; tests/unit/codebaseConventions
// asserts every entry still exists so renames/moves can't leave zombie
// entries behind (that is how the campaign-logo.tsx exemption silently broke
// when the file moved to components/campaign/shell/ during Pass 2 W2).

// Predate the PascalCase component filename convention.
export const legacyComponentFilenameIgnores = [
  'src/components/campaign/shell/campaign-logo.tsx',
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
  'src/components/ui/separator.tsx',
  'src/components/ui/skeleton.tsx',
  'src/components/ui/textarea.tsx',
  'src/components/ui/tooltip.tsx',
]

// Predate the inline-named-function default-export convention for framework
// files. Entries are ESLint glob patterns, so `[` / `]` are escaped.
export const legacyFrameworkExportIgnores = [
  'src/app/(payload)/admin/\\[\\[...segments\\]\\]/not-found.tsx',
  'src/app/(payload)/admin/\\[\\[...segments\\]\\]/page.tsx',
  'src/app/(payload)/layout.tsx',
]

// Predate the arrow-function component convention.
export const legacyComponentSyntaxIgnores = [
  'src/components/StateSelect.tsx',
  'src/components/ThemeProvider.tsx',
]

// Predate the camelCase filename convention for non-component modules.
export const legacyCamelCaseFilenameIgnores = [
  'src/lib/schemas/campaign-login.ts',
  'src/lib/schemas/petition-form.ts',
  'src/lib/schemas/whatsapp-form.ts',
  'tests/int/petition-page-layout.int.spec.ts',
]
