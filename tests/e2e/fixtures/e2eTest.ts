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
  /**
   * Same-origin paths whose failed responses this spec provokes on purpose.
   *
   * A `fetch` the app handles in code still makes the browser log "Failed to
   * load resource", so a spec asserting a refusal (B40: signing in with a
   * revoked passkey) would otherwise fail the guard for doing its job. Declaring
   * the path — rather than allowing 4xx broadly — keeps an unhandled request
   * failure in any other spec a failure. It is an option so a spec declares it
   * once with `test.use`, instead of pushing at exactly the right moment
   * mid-test.
   */
  expectedRequestFailurePaths: string[]
  /** Pathname prefix allowlist for intentional offline prefetch failures. */
  expectedRequestFailurePathPrefixes: string[]
  /** Next.js RSC prefetch console noise while the browser context is offline. */
  allowOfflineRscPrefetchErrors: boolean
}

const loadFailurePrefix = 'Failed to load resource'

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

const isAllowedConsoleError = (
  message: ConsoleMessage,
  origin: string | null,
  expectedRequestFailurePaths: string[],
  expectedRequestFailurePathPrefixes: string[],
  allowOfflineRscPrefetchErrors: boolean,
): boolean => {
  const { url } = message.location()
  if (!url || origin === null) return false

  const location = new URL(url)
  if (location.origin !== origin) return false

  // The app intentionally has no /favicon.ico asset yet.
  if (message.text() === missingFaviconConsoleError) return location.pathname === '/favicon.ico'

  if (
    allowOfflineRscPrefetchErrors &&
    message.text().includes('Failed to fetch RSC payload') &&
    message.text().includes('/campanha')
  ) {
    return true
  }

  const pathAllowed =
    expectedRequestFailurePaths.includes(location.pathname) ||
    expectedRequestFailurePathPrefixes.some((prefix) => location.pathname.startsWith(prefix))

  return message.text().startsWith(loadFailurePrefix) && pathAllowed
}

export const test = base.extend<E2EFailureGuardFixtures>({
  expectedRequestFailurePaths: [[], { option: true }],
  expectedRequestFailurePathPrefixes: [[], { option: true }],
  allowOfflineRscPrefetchErrors: [false, { option: true }],
  e2eFailureGuard: [
    async (
      {
        baseURL,
        context,
        expectedRequestFailurePaths,
        expectedRequestFailurePathPrefixes,
        allowOfflineRscPrefetchErrors,
        page,
      },
      use,
    ) => {
      const failures: BrowserFailure[] = []
      const origin = baseURL ? new URL(baseURL).origin : null

      const onConsole = (message: ConsoleMessage) => {
        if (
          message.type() !== 'error' ||
          isAllowedConsoleError(
            message,
            origin,
            expectedRequestFailurePaths,
            expectedRequestFailurePathPrefixes,
            allowOfflineRscPrefetchErrors,
          )
        ) {
          return
        }
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
