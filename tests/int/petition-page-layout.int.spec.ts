import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('petition page layout', () => {
  const pageSource = readFileSync(
    resolve(process.cwd(), 'src/app/(frontend)/abaixo-assinado/[id]/page.tsx'),
    'utf8',
  )
  const formSource = readFileSync(resolve(process.cwd(), 'src/components/PetitionForm.tsx'), 'utf8')
  const stylesSource = readFileSync(
    resolve(process.cwd(), 'src/app/(frontend)/styles.css'),
    'utf8',
  )
  const inputSource = readFileSync(resolve(process.cwd(), 'src/components/ui/input.tsx'), 'utf8')
  const textareaSource = readFileSync(
    resolve(process.cwd(), 'src/components/ui/textarea.tsx'),
    'utf8',
  )
  const nativeSelectSource = readFileSync(
    resolve(process.cwd(), 'src/components/ui/native-select.tsx'),
    'utf8',
  )

  it('uses the main element as the vertical scroll container', () => {
    const mainClass = pageSource.match(/<main[\s\S]*?className="([^"]+)"/)?.[1]

    expect(mainClass?.split(/\s+/)).toEqual(
      expect.arrayContaining(['h-screen', 'w-screen', 'overflow-y-auto']),
    )
  })

  it('scopes the petition color system to the petition page', () => {
    expect(pageSource).toContain('data-theme="petition"')
    expect(stylesSource).toContain('[data-theme="petition"]')
    expect(stylesSource).toContain('--petition-hero')
    expect(stylesSource).toContain('--petition-form-section')
  })

  it('keeps petition form copy and consent HTML data-driven', () => {
    expect(formSource).toContain('petition.form.subtitle')
    expect(formSource).not.toContain('manter a orla de Salvador')
    expect(pageSource).toContain('consentHTML')
    expect(formSource).not.toContain("convertLexicalToHTML")
  })

  it('uses semantic field color variables for shared form controls', () => {
    for (const source of [inputSource, textareaSource, nativeSelectSource]) {
      expect(source).toContain('--field-background')
      expect(source).toContain('--field-foreground')
      expect(source).toContain('--field-border')
    }
  })
})
