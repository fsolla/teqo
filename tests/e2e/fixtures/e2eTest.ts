import {
  test as base,
  expect,
  type ConsoleMessage,
  type Response,
  type WebError,
} from '@playwright/test'

type FailureKind = 'console.error' | 'pageerror' | 'same-origin 5xx' | 'weberror'

type BrowserFailure = {
  kind: FailureKind
  detail: string
}

type E2EFailureGuardFixtures = {
  e2eFailureGuard: void
}

const missingFaviconConsoleError =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'

const errorDetail = (error: Error): string => error.stack ?? error.message

const responseDetail = (response: Response): string =>
  `${response.status()} ${response.request().method()} ${response.url()}`

const consoleDetail = (message: ConsoleMessage): string => {
  const { url, lineNumber, columnNumber } = message.location()
  const location = url ? ` (${url}:${lineNumber}:${columnNumber})` : ''
  return `${message.text()}${location}`
}

const isAllowedConsoleError = (message: ConsoleMessage, origin: string | null): boolean => {
  const { url } = message.location()
  if (!url || origin === null || message.text() !== missingFaviconConsoleError) return false

  const location = new URL(url)
  // The app intentionally has no /favicon.ico asset yet. This exact same-origin
  // missing-resource message is the only accepted browser console error.
  return location.origin === origin && location.pathname === '/favicon.ico'
}

export const test = base.extend<E2EFailureGuardFixtures>({
  e2eFailureGuard: [
    async ({ baseURL, context, page }, use) => {
      const failures: BrowserFailure[] = []
      const origin = baseURL ? new URL(baseURL).origin : null

      const onConsole = (message: ConsoleMessage) => {
        if (message.type() !== 'error' || isAllowedConsoleError(message, origin)) return
        failures.push({ kind: 'console.error', detail: consoleDetail(message) })
      }
      const onPageError = (error: Error) => {
        failures.push({ kind: 'pageerror', detail: errorDetail(error) })
      }
      const onResponse = (response: Response) => {
        if (
          response.status() >= 500 &&
          origin !== null &&
          new URL(response.url()).origin === origin
        ) {
          failures.push({ kind: 'same-origin 5xx', detail: responseDetail(response) })
        }
      }
      const onWebError = (webError: WebError) => {
        failures.push({ kind: 'weberror', detail: errorDetail(webError.error()) })
      }

      page.on('console', onConsole)
      page.on('pageerror', onPageError)
      page.on('response', onResponse)
      context.on('weberror', onWebError)

      await use()

      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      page.off('response', onResponse)
      context.off('weberror', onWebError)

      if (failures.length) {
        const details = failures
          .map(({ kind, detail }, index) => `${index + 1}. [${kind}] ${detail}`)
          .join('\n\n')
        throw new Error(`Unexpected browser/runtime failures:\n\n${details}`)
      }
    },
    { auto: true },
  ],
})

export { expect }
