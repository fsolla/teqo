import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B18 — a named recorte of `/campanha/municipios` becomes a sidebar shortcut.
 *
 * Own file for the same reason B17 took one: `campaignMunicipalities.e2e.spec.ts`
 * carries deterministic failures at one worker, ledgered as P1, and a red run
 * there must not be read as a regression here.
 */

/** 416 whole municipalities — deep enough that `?page=2` is a real page. */
const SAVED_RECORTE = '/campanha/municipios?kind=municipio'

const SAVED_NAME = 'Recorte do teste'
const RENAMED = 'Recorte renomeado'

/**
 * A route transition on this list costs a full RSC round-trip, and in dev the
 * suite's two workers share one server — which overruns the 5 s default of
 * `expect` and produces a flake nobody reproduces at one worker. Same budget,
 * for the same reason, as `campaignColumnPicker.e2e.spec.ts`.
 */
const NAVIGATION = { timeout: 20_000 }

test.describe('Filtros salvos de Municípios', () => {
  test('saves the current recorte, restores it from the sidebar and deletes it', async ({
    campaign,
    page,
  }) => {
    test.slow()

    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('filtros-coordinator')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Filtros'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    await campaign.login(page, email, password)

    // The bare list has no recorte to name.
    await page.goto('/campanha/municipios')
    await expect(page.getByRole('button', { name: 'Salvar filtro', exact: true })).toHaveCount(0)

    await page.goto(SAVED_RECORTE)
    await page.getByRole('button', { name: 'Salvar filtro', exact: true }).click()
    const nameInput = page.getByLabel('Nome do filtro')
    // The suggested name is the active-filters summary the bar already shows.
    await expect(nameInput).not.toHaveValue('')
    await nameInput.fill(SAVED_NAME)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    const shortcut = page.getByRole('link', { name: SAVED_NAME })
    await expect(shortcut).toBeVisible()
    await expect(shortcut).toHaveAttribute('aria-current', 'page')

    // A page is a position inside the recorte, not part of it.
    await page.goto(`${SAVED_RECORTE}&page=2`)
    await expect(shortcut).toHaveAttribute('aria-current', 'page')

    // Another recorte is not this one, and the shortcut brings it back.
    await page.goto('/campanha/municipios')
    await expect(shortcut).not.toHaveAttribute('aria-current', 'page')
    await shortcut.click()
    await expect(page).toHaveURL(SAVED_RECORTE, NAVIGATION)
    await expect(shortcut).toHaveAttribute('aria-current', 'page', NAVIGATION)

    // Saving a recorte already bookmarked renames it instead of adding a twin.
    await page.getByRole('button', { name: `Renomear o filtro salvo ${SAVED_NAME}` }).click()
    await expect(page.getByLabel('Nome do filtro')).toHaveValue(SAVED_NAME)
    await page.getByLabel('Nome do filtro').fill(RENAMED)
    await page.getByRole('button', { name: 'Atualizar nome' }).click()
    await expect(page.getByRole('link', { name: RENAMED })).toBeVisible()
    await expect(shortcut).toHaveCount(0)

    const remove = page.getByRole('button', { name: `Apagar o filtro salvo ${RENAMED}` })
    await remove.click()
    await expect(page.getByRole('link', { name: RENAMED })).toHaveCount(0)
    // Emptying the group unmounts the disclosure too, so focus lands on the
    // nav link rather than falling to <body>.
    await expect(page.getByRole('link', { name: 'Municípios', exact: true })).toBeFocused()

    // Deleting is undoable, which is why it never asks for confirmation.
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(page.getByRole('link', { name: RENAMED })).toBeVisible()
  })

  test('survives a reload and hides the shortcuts behind the disclosure', async ({
    campaign,
    page,
  }) => {
    // Three loads of a heavy list route, against a dev server shared with the
    // other worker — the login redirect alone can outrun the 30 s default.
    test.slow()

    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('filtros-disclosure')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Disclosure'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    await campaign.login(page, email, password)
    await page.goto(SAVED_RECORTE)
    await page.getByRole('button', { name: 'Salvar filtro', exact: true }).click()
    await page.getByLabel('Nome do filtro').fill(SAVED_NAME)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    const shortcut = page.getByRole('link', { name: SAVED_NAME })
    await expect(shortcut).toBeVisible()

    await page.reload()
    await expect(shortcut).toBeVisible(NAVIGATION)

    await page
      .getByRole('button', { name: 'Ocultar os filtros salvos de Municípios' })
      .click(NAVIGATION)
    await expect(shortcut).toBeHidden()

    // The collapsed disclosure is remembered across a reload.
    await page.reload()
    await expect(page.getByRole('link', { name: SAVED_NAME })).toBeHidden(NAVIGATION)
    await page
      .getByRole('button', { name: 'Mostrar os filtros salvos de Municípios' })
      .click(NAVIGATION)
    await expect(page.getByRole('link', { name: SAVED_NAME })).toBeVisible()
  })
})
