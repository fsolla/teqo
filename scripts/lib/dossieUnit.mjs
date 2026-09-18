/**
 * Unit seam for the Solla dossiê pipeline (C187, owner: the C186 dossiê).
 *
 * The dossiê was born municipality-shaped (C186). C187 adds an INSTITUTION
 * recorte that must not fork the pipeline, so the shared mechanics
 * (research contract, print shell, PDF emit, bulletin ledger) take a `unit`
 * descriptor and default to `MUNICIPALITY_UNIT` — the C186 behaviour stays
 * byte-identical when no unit is passed.
 *
 * Vocabulary note: a unit's `spheres` are the item ABRANGÊNCIA values
 * (`municipio|regiao|polo` × `instituicao|setor|rede`). The catalog `sphere`
 * (federal/estadual/…) is a different object and never enters an item row.
 */

export const MUNICIPALITY_UNIT = {
  id: 'municipality',
  /** Key that carries the resolved unit slug in research/snapshot files. */
  slugField: 'municipalitySlug',
  spheres: ['municipio', 'regiao', 'polo'],
  defaultSphere: 'municipio',
  sphereLabels: { municipio: 'município', regiao: 'região', polo: 'polo' },
  sphereBadgeClass: { municipio: '', regiao: 'scope-region', polo: 'scope-region' },
  /** Bulletin ranking: a direct item outranks a shared-scope one. */
  breadthRank: { municipio: 0, regiao: 1, polo: 2 },
  researchDir: 'data/dossie-solla-cidade',
  series: 'Série municipal · BA',
  title: 'Dossiê Solla por cidade',
  bulletinTitle: 'Boletim informativo modelo',
  /** "E mais" budget of the one-page boletim (long labels wrap, so units differ). */
  bulletinMoreLimit: 12,
  /** Print copy that changes with the recorte (shared renderers read these). */
  sphereColumnLabel: 'Esfera',
  notSummedInline: 'não somar à cidade',
  sumGuardNote: 'região e polo não são somados ao município.',
  acervoNote: 'recorte municipal (menção confirmada); região e polo não entram nesta conta.',
  eraNumbersTitle: 'Recursos e entregas quantificáveis',
  eraActionsTitle: 'O que fez — item, alcance e lastro',
  honorsTitle: 'Títulos, honrarias e vínculos locais',
}

export const INSTITUTION_UNIT = {
  id: 'institution',
  slugField: 'institutionSlug',
  spheres: ['instituicao', 'setor', 'rede'],
  defaultSphere: 'instituicao',
  sphereLabels: { instituicao: 'instituição', setor: 'setor', rede: 'rede' },
  sphereBadgeClass: { instituicao: '', setor: 'scope-sector', rede: 'scope-network' },
  breadthRank: { instituicao: 0, setor: 1, rede: 2 },
  researchDir: 'data/dossie-solla-instituicao',
  series: 'Série institucional · agenda com lastro',
  title: 'Dossiê Solla por instituição',
  bulletinTitle: 'Boletim informativo modelo',
  bulletinMoreLimit: 10,
  sphereColumnLabel: 'Abrangência',
  notSummedInline: 'não somar à instituição',
  sumGuardNote: 'setor e rede não são somados à instituição.',
  acervoNote: 'recorte por tema, não nominal; não somar à instituição.',
  eraNumbersTitle: 'Objeto, valor, fase e alcance',
  eraActionsTitle: 'Papéis com evidência visível',
  honorsTitle: 'Títulos, honrarias e vínculos institucionais',
}

const DOSSIER_UNITS = {
  municipality: MUNICIPALITY_UNIT,
  institution: INSTITUTION_UNIT,
}

/**
 * Accepts an id string or a descriptor; absent → municipality (C186 default).
 *
 * @param {any} [unit]
 * @returns {any}
 */
export const resolveDossierUnit = (unit) => {
  if (!unit) return MUNICIPALITY_UNIT
  if (typeof unit === 'string') {
    const resolved = DOSSIER_UNITS[unit]
    if (!resolved) throw new Error(`Unidade de dossiê desconhecida: "${unit}".`)
    return resolved
  }
  return unit
}

/** Central predicate for the dispatch points (dossiê, boletim, blocks). */
export const isInstitutionUnit = (unit) => resolveDossierUnit(unit).id === 'institution'
