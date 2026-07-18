import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({
  cwd: process.cwd(),
  cache: false,
})

const fixingEslint = new ESLint({
  cwd: process.cwd(),
  cache: false,
  fix: true,
})

const lint = async (filePath: string, code: string) => {
  const [result] = await eslint.lintText(code, { filePath })

  return {
    errors: result.messages.filter(({ severity }) => severity === 2),
    output: result.output,
  }
}

const lintWithFix = async (filePath: string, code: string) => {
  const [result] = await fixingEslint.lintText(code, { filePath })

  return result.output
}

const expectValid = async (filePath: string, code: string) => {
  const { errors } = await lint(filePath, code)

  expect(errors).toEqual([])
}

const expectInvalid = async (filePath: string, code: string, ruleId: string) => {
  const { errors } = await lint(filePath, code)

  expect(errors.some((error) => error.ruleId === ruleId)).toBe(true)
}

describe('ESLint conventions', () => {
  it(
    'enforces PascalCase component and camelCase utility/test filenames',
    async () => {
      await expectValid('src/components/FutureCard.tsx', 'export const FutureCard = () => <div />')
      await expectInvalid(
        'src/components/future-card.tsx',
        'export const FutureCard = () => <div />',
        'check-file/filename-naming-convention',
      )
      await expectValid('src/utilities/futureValue.ts', 'export const futureValue = 1')
      await expectValid('tests/int/futureValue.int.spec.ts', 'export const futureValue = 1')
      await expectInvalid(
        'tests/int/future-value.int.spec.ts',
        'export const futureValue = 1',
        'check-file/filename-naming-convention',
      )
    },
    15_000,
  )

  it('requires uppercase component arrows to use const', async () => {
    await expectInvalid(
      'src/components/FutureCard.tsx',
      'export let FutureCard = () => <div />',
      'local/component-arrow-conventions',
    )
  })

  it('requires implicit JSX returns only for pure component arrows', async () => {
    const code = 'export const FutureCard = () => { return <div /> }'
    const result = await lint('src/components/FutureCard.tsx', code)
    const output = await lintWithFix('src/components/FutureCard.tsx', code)

    expect(result.errors.some((error) => error.ruleId === 'local/component-arrow-conventions')).toBe(
      true,
    )
    expect(output).toContain('export const FutureCard = () => (<div />)')

    await expectValid(
      'src/components/FutureList.tsx',
      'export const FutureList = () => { const items = [1]; return items.map((item) => { return <div key={item}>{item}</div> }) }',
    )
  })

  it('reports pure JSX component returns without deleting block comments', async () => {
    const code = 'export const FutureCard = () => { /* keep this rationale */ return <div /> }'
    const result = await lint('src/components/FutureCard.tsx', code)
    const output = (await lintWithFix('src/components/FutureCard.tsx', code)) ?? code

    expect(result.errors.some((error) => error.ruleId === 'local/component-arrow-conventions')).toBe(
      true,
    )
    expect(output).toContain('keep this rationale')
  })

  it('allows callback block returns without applying arrow-body-style globally', async () => {
    await expectValid(
      'src/components/FutureList.tsx',
      'export const FutureList = () => [1].map((item) => { return <div key={item}>{item}</div> })',
    )
  })

  it('rejects every ordinary component default export form', async () => {
    const examples = [
      'export default function FutureCard() { return <div /> }',
      'const futureCard = () => <div />; export default futureCard',
      'export default memo(() => <div />)',
      'export default (function FutureCard() { return <div /> })',
      'export default function () { return <div /> }',
      'export default (() => <div />)',
    ]

    for (const code of examples) {
      await expectInvalid(
        'src/components/FutureCard.tsx',
        code,
        'local/no-component-default-export',
      )
    }
  })

  it('accepts only an inline named function default in Next framework files', async () => {
    await expectValid(
      'src/app/future/page.tsx',
      'export default function FuturePage() { return <div /> }',
    )

    const invalidExamples = [
      'const futurePage = () => <div />; export default futurePage',
      'const FuturePage = () => <div />; export default FuturePage',
      'export default memo(() => <div />)',
      'export default (function FuturePage() { return <div /> })',
      'export default (() => <div />)',
      'export default function () { return <div /> }',
    ]

    for (const code of invalidExamples) {
      await expectInvalid(
        'src/app/future/page.tsx',
        code,
        'local/framework-default-export',
      )
    }
  })

  it('requires Next framework files to have a default export', async () => {
    await expectInvalid(
      'src/app/future/page.tsx',
      'export function FuturePage() { return <div /> }',
      'local/framework-default-export',
    )
  })

  it('limits Payload admin exemptions to the exact existing catch-all files', async () => {
    await expectValid(
      'src/app/(payload)/admin/[[...segments]]/page.tsx',
      'const Page = () => <div />; export default Page',
    )
    await expectValid(
      'src/app/(payload)/admin/[[...segments]]/not-found.tsx',
      'const NotFound = () => <div />; export default NotFound',
    )
    await expectInvalid(
      'src/app/(payload)/admin/future/page.tsx',
      'export function FutureAdminPage() { return <div /> }',
      'local/framework-default-export',
    )
  })

  it('exempts non-component config object defaults', async () => {
    await expectValid(
      'src/utilities/futureConfig.ts',
      'const futureConfig = { enabled: true }; export default futureConfig',
    )
  })
})
