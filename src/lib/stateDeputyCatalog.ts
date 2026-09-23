/**
 * Static catalog of the 53 state-deputy cards ("dobradinhas") of the campaign
 * site (S30) — the roster behind the `time-do-estadual` card model. The table
 * is derived from the official artwork delivered by the campaign: the display
 * name and the ballot number come from the lockup baked into each front art
 * (the campaign database has no 2026 ballot number), and the slugs come from
 * the delivered folder names.
 *
 * It is committed as an immutable table: the slug and the two asset paths are
 * the public contract of the model, and the selector shows the name + number.
 * The originals never enter the repo; `public/cards/estaduais/<slug>-{fotos,base}.webp`
 * are the optimized derivatives produced (and re-producible) by
 * `scripts/build-state-deputy-card-assets.mjs --from <origin>`.
 *
 * Stability is guarded by tests/fixtures/state-deputy-catalog.snapshot.json.
 */

export interface StateDeputyCatalogEntry {
  /** Canonical immutable slug — asset path segment and selector identity. */
  readonly slug: string
  /** Display name from the lockup, e.g. "Julio Pinheiro". */
  readonly name: string
  /** Five-digit ballot number from the lockup, digits only (e.g. "13999"). */
  readonly ballotNumber: string
  /** Background art (group + the deputy) drawn under the visitor's cutout. */
  readonly photosSrc: string
  /** Front overlay art (band with the deputy's lockup) drawn above it. */
  readonly baseSrc: string
}

const ESTADUAL_ASSETS_DIR = '/cards/estaduais'

const entry = (slug: string, name: string, ballotNumber: string): StateDeputyCatalogEntry => ({
  slug,
  name,
  ballotNumber,
  photosSrc: `${ESTADUAL_ASSETS_DIR}/${slug}-fotos.webp`,
  baseSrc: `${ESTADUAL_ASSETS_DIR}/${slug}-base.webp`,
})

/** Alphabetical by delivered folder name (stable order, never a ranking). */
export const stateDeputyCatalog: readonly StateDeputyCatalogEntry[] = [
  entry('adriana', 'Coletivo de Enfermagem', '13763'),
  entry('andre', 'André Fidalgo', '13131'),
  entry('andrea', 'Andréa Castro', '55670'),
  entry('angelo', 'Angelo Almeida', '13100'),
  entry('arthur', 'Artur Barachisio Lisbôa', '55255'),
  entry('bobo', 'Bobô', '65888'),
  entry('carol', 'Carol da Pitanguinha', '13110'),
  entry('cicero', 'Cícero Monteiro', '70133'),
  entry('denise', 'Denise Menezes', '55111'),
  entry('elane', 'Dra. Elaine', '55100'),
  entry('euclides', 'Euclides Fernandes', '13123'),
  entry('fabiola', 'Dra. Fabíola Mansur', '43123'),
  entry('fatima', 'Fátima Nunes', '13567'),
  entry('felipe', 'Felipe Duarte', '70111'),
  entry('geane', 'Geane Vasconcelos', '12120'),
  entry('hilton', 'Hilton', '50150'),
  entry('ivana', 'Ivana Bastos', '55555'),
  entry('jaco', 'Jacó', '13130'),
  entry('jamille', 'Jamile da Saúde', '45456'),
  entry('josafa', 'Josafá Marinho', '12222'),
  entry('juliete', 'Juliete Barreto', '65100'),
  entry('julio', 'Julio Pinheiro', '13999'),
  entry('junior', 'Júnior Muniz', '13000'),
  entry('kleber', 'Kleber Rosa', '50500'),
  entry('leninha', 'Lenínha Valente', '13111'),
  entry('leo', 'Leo de Neco', '70700'),
  entry('ludmilla', 'Ludmilla', '55444'),
  entry('magno', 'Magno', '18000'),
  entry('marcos', 'Dr. Marcos Adriano', '12999'),
  entry('marlene', 'Marlene do Sindicato', '18111'),
  entry('mestre', 'Mestre Reginaldo', '18273'),
  entry('neusa', 'Neusa Cadore', '13690'),
  entry('niltinho', 'Niltinho', '55999'),
  entry('osni', 'Osni', '13013'),
  entry('pablo', 'Pablo Barrozo', '70900'),
  entry('patrick', 'Patrick Lopes', '70123'),
  entry('pinheiro', 'Pinheiro', '13700'),
  entry('radiovaldo', 'Radiovaldo', '13050'),
  entry('roberto', 'Roberto Carlos', '43333'),
  entry('robinson', 'Robinson', '13500'),
  entry('rogerio', 'Rogério Andrade', '15444'),
  entry('rosemberg', 'Rosemberg', '13444'),
  entry('rosival', 'Rosival Leite', '13333'),
  entry('rowenna', 'Rowenna', '13456'),
  entry('silva', 'Silva Neto', '70444'),
  entry('silvio', 'Silvio Dias', '13113'),
  entry('thiago', 'Thiago Gilleno', '10000'),
  entry('vilma', 'Vilma Reis', '13033'),
  entry('vitor', 'Vitor Azevedo', '70333'),
  entry('welligton', 'Wellington Oliveira', '40888'),
  entry('wenceslau', 'Wenceslau', '65111'),
  entry('yulo', 'Yulo', '13234'),
  entry('ze-raimundo', 'Zé Raimundo', '13222'),
]

const catalogBySlug = new Map(stateDeputyCatalog.map((card) => [card.slug, card]))

export const getStateDeputyCard = (slug: string): StateDeputyCatalogEntry | undefined =>
  catalogBySlug.get(slug)

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/**
 * Accent/case-insensitive search by display name; an empty query keeps all.
 * The delivered folder name (the slug) is also accepted as a keyword, so
 * `adriana` finds the entry whose art shows "Coletivo de Enfermagem".
 */
export const filterStateDeputyCards = (query: string): readonly StateDeputyCatalogEntry[] => {
  const needle = normalize(query)
  if (!needle) return stateDeputyCatalog

  return stateDeputyCatalog.filter(
    (card) => normalize(card.name).includes(needle) || normalize(card.slug).includes(needle),
  )
}
