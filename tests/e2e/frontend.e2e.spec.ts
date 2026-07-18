import { expect, test } from './fixtures/e2eTest'

test.describe('Frontend', () => {
  test('can go on homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Jorge Solla/)

    const heading = page.locator('h1').first()

    await expect(heading).toHaveText('O mandato do tamanho da Bahia')
  })
})
