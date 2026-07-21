import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { act, createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loginAction: vi.fn(),
}))

vi.mock('@/app/(campaign)/campanha/actions/auth', () => ({
  loginCampaign: mocks.loginAction,
  loginCampaignFormAction: mocks.loginAction,
}))

import { LoginForm } from '@/app/(campaign)/campanha/login/LoginForm'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'

const sourceRoot = resolve(process.cwd(), 'src')
const localImportPattern = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g

const resolveLocalModule = (importer: string, specifier: string): string | null => {
  const base = specifier.startsWith('@/')
    ? resolve(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null
  if (!base) return null
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const collectLocalDependencyGraph = (entry: string, visited = new Set<string>()): Set<string> => {
  if (visited.has(entry)) return visited
  visited.add(entry)
  const source = readFileSync(entry, 'utf8')
  for (const match of source.matchAll(localImportPattern)) {
    if (/^import\s+type\b/.test(match[0])) continue
    const dependency = resolveLocalModule(entry, match[1]!)
    if (dependency && !/^['"]use server['"]/.test(readFileSync(dependency, 'utf8'))) {
      collectLocalDependencyGraph(dependency, visited)
    }
  }
  return visited
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('campaign login composition', () => {
  it('keeps client validation libraries out of the login graph', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(campaign)/campanha/login/LoginForm.tsx'),
      'utf8',
    )

    expect(source).not.toContain('@hookform/resolvers')
    expect(source).not.toContain('react-hook-form')
    expect(source).not.toContain('campaignLoginSchema')
  })

  it('uses native constraints and password-manager metadata', () => {
    render(createElement(LoginForm))

    const identifier = screen.getByLabelText('E-mail ou celular')
    const password = screen.getByLabelText('Senha')
    const submit = screen.getByRole('button', { name: 'Entrar' })

    expect(screen.getByRole('heading', { level: 1, name: 'Entrar na campanha' })).toBeTruthy()
    expect(identifier.getAttribute('name')).toBe('identifier')
    expect(identifier.hasAttribute('required')).toBe(true)
    expect(identifier.getAttribute('autocomplete')).toBe('username')
    expect(identifier.getAttribute('inputmode')).toBe('text')
    expect(password.getAttribute('name')).toBe('password')
    expect(password.hasAttribute('required')).toBe(true)
    expect(password.getAttribute('autocomplete')).toBe('current-password')
    expect(submit.getAttribute('type')).toBe('submit')
    expect(submit.className).toContain('w-full')
  })

  it('switches identifier inputMode toward phone or email as the user types', () => {
    render(createElement(LoginForm))
    const identifier = screen.getByLabelText('E-mail ou celular')

    fireEvent.change(identifier, { target: { value: '(71) 9' } })
    expect(identifier.getAttribute('inputmode')).toBe('tel')

    fireEvent.change(identifier, { target: { value: 'staff@' } })
    expect(identifier.getAttribute('inputmode')).toBe('email')
  })

  it('links auth errors to both credential fields and shows leadership recovery copy', async () => {
    mocks.loginAction.mockResolvedValue({ error: 'E-mail, celular ou senha inválidos.' })
    render(createElement(LoginForm))

    fireEvent.change(screen.getByLabelText('E-mail ou celular'), {
      target: { value: '71' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'wrong' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)

    const alert = await screen.findByRole('alert')
    expect(alert.id).toBe('login-credentials-error')
    expect(alert.textContent).toContain('E-mail, celular ou senha inválidos.')
    expect(screen.getByLabelText('E-mail ou celular').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Senha').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('E-mail ou celular').getAttribute('aria-describedby')).toBe(
      'login-credentials-error',
    )
    expect(screen.getByLabelText('Senha').getAttribute('aria-describedby')).toBe(
      'login-credentials-error',
    )
    expect(
      screen.getByText(/Conta só com celular\? Peça um novo convite ao coordenador/),
    ).toBeTruthy()
  })

  it('shows the pending spinner and announces an action error', async () => {
    let resolveAction: ((value: { error: string }) => void) | undefined
    mocks.loginAction.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          resolveAction = resolve
        }),
    )
    render(createElement(LoginForm))

    fireEvent.change(screen.getByLabelText('E-mail ou celular'), {
      target: { value: 'staff@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: '  wrong-password  ' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)

    const pendingButton = await screen.findByRole('button', { name: 'Entrando...' })
    const submittedFormData = mocks.loginAction.mock.calls[0]?.[1]
    expect(submittedFormData).toBeInstanceOf(FormData)
    expect((submittedFormData as FormData).get('identifier')).toBe('staff@example.com')
    expect((submittedFormData as FormData).get('password')).toBe('  wrong-password  ')
    expect(pendingButton.querySelector('[data-slot="spinner"]')).not.toBeNull()
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveAction?.({ error: 'E-mail, celular ou senha inválidos.' })
    })

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'E-mail, celular ou senha inválidos.',
      ),
    )
  })
})

describe('campaign client module boundaries', () => {
  it('keeps every client dependency graph free of server FormData and Node-only modules', () => {
    const clientEntries = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name)))
      .map((entry) => resolve(entry.parentPath, entry.name))
      .filter((file) => /^['"]use client['"]/.test(readFileSync(file, 'utf8')))

    for (const entry of clientEntries) {
      for (const dependency of collectLocalDependencyGraph(entry)) {
        const source = readFileSync(dependency, 'utf8')
        expect(dependency).not.toBe(resolve(sourceRoot, 'lib/formData.ts'))
        expect(source, `${dependency} entered the client graph`).not.toMatch(
          /(?:from\s+['"]node:|require\(['"]node:|\bBuffer\b)/,
        )
      }
    }
  })

})

describe('static table composition', () => {
  const table = createElement(
    Table,
    null,
    createElement(
      TableHeader,
      null,
      createElement(TableRow, null, createElement(TableHead, null, 'Nome')),
    ),
    createElement(
      TableBody,
      null,
      createElement(TableRow, null, createElement(TableCell, null, 'Praça Centro')),
    ),
  )

  it('has no client-only directive or browser dependencies', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/Table.tsx'), 'utf8')

    expect(source).not.toMatch(/^['"]use client['"]/)
    expect(source).not.toMatch(/\buse(State|Effect|LayoutEffect|Ref|Memo|Callback)\b/)
    expect(source).not.toMatch(/\b(window|document|navigator)\b/)
  })

  it('renders on the server and hydrates without mismatches', async () => {
    const html = renderToStaticMarkup(table)
    const container = document.createElement('div')
    container.innerHTML = html
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, table)
    })

    expect(container.querySelector('table')).not.toBeNull()
    expect(container.textContent).toContain('Praça Centro')
    expect(consoleError).not.toHaveBeenCalled()

    await act(async () => root?.unmount())
    consoleError.mockRestore()
  })
})
