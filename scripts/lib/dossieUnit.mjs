/**
 * Unit seam for the Solla dossiê pipeline (C187, owner: the C186 dossiê).
 *
 * The dossiê was born municipality-shaped (C186). C187 adds an INSTITUTION
 * recorte and C190 a THEME/AREA recorte; neither may fork the pipeline, so the
 * shared mechanics (research contract, print shell, PDF emit, bulletin ledger)
 * take a `unit` descriptor and default to `MUNICIPALITY_UNIT` — the C186
 * behaviour stays byte-identical when no unit is passed. Institution and theme
 * share the same `subject` shape (three scope lists, per-era flowing sheets,
 * honor handling, bulletin copy) and differ only in vocabulary/copy, which the
 * descriptor carries.
 *
 * Vocabulary note: a unit's `spheres` are the item ABRANGÊNCIA values
 * (`municipio|regiao|polo` × `instituicao|setor|rede` × `area|segmento|rede`).
 * The catalog `sphere` (federal/estadual/…) is a different object and never
 * enters an item row.
 */

/**
 * Theme/area copy uses the preposition the canonical label asks for
 * ("pela Educação", "pelo Esporte", "pelos Direitos Humanos…"), with an explicit
 * map for the 18 `SPEECH_TOPICS` labels and a neutral fallback for any label
 * outside the taxonomy — never a guessed gender.
 */
const THEME_SUBJECT_PHRASES = {
  Saúde: 'pela Saúde',
  Educação: 'pela Educação',
  Cultura: 'pela Cultura',
  Esporte: 'pelo Esporte',
  'Segurança Pública': 'pela Segurança Pública',
  'Meio Ambiente': 'pelo Meio Ambiente',
  'Economia e Trabalho': 'pela Economia e Trabalho',
  'Direitos Humanos e Assistência Social': 'pelos Direitos Humanos e Assistência Social',
  'Infraestrutura e Transporte': 'pela Infraestrutura e Transporte',
  'Ciência e Tecnologia': 'pela Ciência e Tecnologia',
  'Política e Instituições': 'pela Política e Instituições',
  'Agricultura e Agropecuária': 'pela Agricultura e Agropecuária',
  'Habitação e Cidades': 'pela Habitação e Cidades',
  'Comunicação e Mídia': 'pela Comunicação e Mídia',
  'Igualdade Racial': 'pela Igualdade Racial',
  'Mulheres e Gênero': 'pelas Mulheres e Gênero',
  Juventude: 'pela Juventude',
  'Pessoa com Deficiência': 'pela Pessoa com Deficiência',
}

/** @param {string} label @returns {string} */
export const themeSubjectPhrase = (label) => THEME_SUBJECT_PHRASES[label] ?? `pela área de ${label}`

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
  /** C186 literal kept verbatim (byte-parity); subject units override it. */
  synthesisSumGuard: 'Setor e rede não são somados à instituição.',
}

export const INSTITUTION_UNIT = {
  id: 'institution',
  shape: 'subject',
  /** Key that holds the recorte identity in research/snapshot files. */
  slugField: 'institutionSlug',
  snapshotField: 'institution',
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
  synthesisSumGuard: 'Setor e rede não são somados à instituição.',
  aria: {
    synthesis: 'Síntese da atuação institucional',
    charts: 'Gráficos consolidados da atuação institucional',
    sources: 'Fontes e limites do dossiê institucional',
    scope: 'Painel de abrangência institucional',
  },
  /** Subject-shape fields (shared with THEME_UNIT). */
  nounPlural: 'instituições',
  subjectNoun: 'instituição',
  docLabel: 'Dossiê institucional',
  contributionLabel: 'instituição',
  scopeLabel: 'no recorte institucional',
  summaryLinkEyebrow: '01 · vínculo com a instituição',
  honorsSheet: true,
  notSummedTo: 'à instituição',
  scopeLists: [
    { key: 'institution', sphere: 'instituicao' },
    { key: 'sector', sphere: 'setor' },
    { key: 'network', sphere: 'rede' },
  ],
  scopeListWords: { institution: 'instituicao', sector: 'setor', network: 'rede' },
  scopeCardClass: { instituicao: '', setor: 'card-sector', rede: 'card-network' },
  eraMethod: {
    A: 'Registros anteriores a 2007 que citem nominalmente a instituição ou comprovem vínculo. Cargo geral não prova ação institucional.',
    B: 'A gestão estadual é lida por equipamento, programa, convênio e obra; cada linha informa abrangência e fonte. Setor e rede não somam à instituição.',
    C: 'Mandato, relatorias, parcerias e execução financeira têm datas e estágios distintos. Empenho não é pagamento; o valor sempre acompanha a fase.',
  },
  eraRecovery: {
    A: 'biografias oficiais · atos e diários · acervos institucionais · busca web datada',
    B: 'DOE-BA (DOOL) · notícias SESAB/instituição · Transparência Bahia · busca web datada',
    C: 'API Câmara · Portal da Transparência · acervo interno read-only · busca web datada',
  },
  identityBadges: (identity) =>
    [identity.kindLabel, identity.sphereLabel, identity.scope ? identity.scopeLabel : null].filter(
      Boolean,
    ),
  identityRows: (identity) =>
    [
      ['Nome', identity.name],
      ['Tipo', identity.kindLabel],
      ['Esfera', identity.sphereLabel],
      ['Alcance', identity.scopeLabel],
      ['Alias', (identity.aliases ?? []).join(' · ') || '—'],
    ].filter(([, value]) => Boolean(value)),
  coverRows: (report) => [{ label: 'Identificação', badges: report.meta.identityBadges }],
  copy: {
    coverSubtitle: () => 'O que Jorge Solla fez por, na e com a instituição ao longo da carreira',
    coverHowToUse:
      'Localize o vínculo ou a entrega, confira fonte, data, fase e abrangência. Transforme toda lacuna em tarefa de apuração. Este arquivo não é fala pronta nem peça pública.',
    coverScope:
      'Escopo: carreira técnica e gestão pública até 2006 · SESAB 2007–2014 · Câmara dos Deputados 2015–2027. Instituição, setor e rede separados; sem fonte, não entra como entrega.',
    coverScopeWords: 'instituição, setor e rede separados',
    coverAsset: ['selo da instituição', 'uso autorizado e origem'],
    openingTitle: (subjectName) => `O que Jorge Solla fez pela e na ${subjectName}`,
    reachRuleTitle: 'Setor/rede não é a instituição. Não some os recortes.',
    reachRuleBody:
      'Uma política para uma categoria ou uma articulação com entidades correlatas pode alcançar a instituição sem constituir entrega exclusiva para ela.',
    synthesisGuard: 'setor e rede nunca somados à instituição.',
    coverageNote: 'Instituição, setor e rede separados; sem fonte, não entra como entrega.',
    timelineEmpty: 'Nenhum vínculo datado com fonte — ver lacunas explícitas.',
    eraEmpty: {
      body: 'A pesquisa não encontrou documento que sustenta uma afirmação institucional. Isso não prova que não houve vínculo ou atuação; prova apenas que o dossiê ainda não pode afirmá-los.',
      work: [
        'Busca nominal por instituição e aliases.',
        'Consulta a fontes oficiais e acervos datados.',
        'Triagem de resultados por vínculo e abrangência.',
        'Descarte de menções sem lastro suficiente.',
      ],
      todo: [
        'Solicitar consulta ao arquivo físico.',
        'Validar nome histórico e unidade da instituição.',
        'Recuperar ato, ata ou documento contemporâneo.',
        'Repetir busca com alias confirmado.',
      ],
      rule: (eraLabel) =>
        `Não preencher a seção por memória, cargo provável ou texto de outra era. Registrar “${eraLabel}: evidência institucional não localizada nas fontes consultadas”.`,
    },
    limits: {
      coverage: [
        'O acervo interno de falas cobre 2011+; períodos anteriores dependem de fontes externas.',
        'Resultado de busca não prova ausência histórica.',
        'Emenda de bancada ou relator só recebe autoria quando a fonte a confirma.',
        'Menção a entidade correlata (setor/rede) não é atribuição à instituição.',
      ],
      editorial: [
        'Sem fonte, não publica.',
        'URL e data acompanham cada afirmação não trivial.',
        'Instituição, setor e rede permanecem separados.',
        'Valor sempre informa a fase de execução.',
      ],
    },
    mdAcervoNote: 'Recorte por tema, não nominal.',
    bulletin: {
      aria: 'Modelo de boletim informativo institucional de uma página',
      openingLabel: 'Uma trajetória de trabalho junto à instituição',
      openingTitle: (subjectName) => `O que Jorge Solla fez pela e na ${subjectName}`,
      lead: 'Ações, recursos e articulações explicados de forma direta — somente o que já foi documentado no dossiê institucional.',
      leadSparse:
        'Esta versão tem poucos registros confirmados. Em vez de preencher espaço, mostra só os fatos que o dossiê sustenta.',
      asset: 'Solla na instituição ou na ação citada',
      assetSparse: 'somente registro relacionado ao fato',
      assetSelo: ['marca autorizada da instituição', 'arquivo vetorial'],
      assetClipping: ['registro real da ação', 'origem e licença'],
      moreEmpty:
        'Conferir as lacunas explícitas no dossiê institucional antes de ampliar o boletim.',
      defeso:
        'fase acompanha cada valor · instituição, setor e rede não são somados · sem percentual estadual absoluto.',
      orig: 'Conteúdo selecionado do dossiê institucional.',
      remaining: 'no dossiê da instituição — o boletim de uma página não os exibe.',
      sparseRule:
        'Não repetir item, não ampliar efeito e não preencher com ação de setor ou rede como se fosse entrega exclusiva da instituição.',
      title: 'Uma trajetória de compromisso com o serviço público',
      titleSparse: 'contexto de carreira · não substitui fato institucional',
      highlightsTitle: 'Resultados em leitura rápida',
      highlightsTitleSparse: 'Poucos fatos, sem enchimento',
      moreTitle: 'Outras ações confirmadas',
      moreTitleSparse: 'Outros registros confirmados',
    },
  },
}

export const THEME_UNIT = {
  id: 'theme',
  shape: 'subject',
  slugField: 'themeSlug',
  snapshotField: 'theme',
  spheres: ['area', 'segmento', 'rede'],
  defaultSphere: 'area',
  sphereLabels: { area: 'área', segmento: 'segmento', rede: 'rede' },
  sphereBadgeClass: { area: '', segmento: 'scope-sector', rede: 'scope-network' },
  breadthRank: { area: 0, segmento: 1, rede: 2 },
  researchDir: 'data/dossie-solla-tema',
  series: 'Série temática · por área',
  title: 'Dossiê Solla por tema/área',
  bulletinTitle: 'Boletim informativo modelo',
  bulletinMoreLimit: 14,
  bulletinKicker: 'Boletim informativo · série temática',
  sphereColumnLabel: 'Abrangência',
  notSummedInline: 'não somar à área',
  sumGuardNote: 'segmento e rede não são somados à área.',
  acervoNote: 'recorte pela tag do acervo (Speech.topics); segmento e rede não entram nesta conta.',
  eraNumbersTitle: 'Objeto, valor, ano, fase e abrangência',
  eraActionsTitle: 'Papéis e iniciativas com evidência visível',
  honorsTitle: 'Títulos, honrarias e vínculos',
  synthesisSumGuard: 'Segmento e rede não são somados à área.',
  aria: {
    synthesis: 'Síntese da atuação por área',
    charts: 'Gráficos consolidados da atuação por área',
    sources: 'Fontes e limites do dossiê temático',
    scope: 'Painel de abrangência por área',
  },
  nounPlural: 'temas',
  subjectNoun: 'área',
  docLabel: 'Dossiê temático',
  contributionLabel: 'área',
  scopeLabel: 'no recorte da área',
  summaryLinkEyebrow: '01 · vínculo com a área',
  honorsSheet: false,
  notSummedTo: 'à área',
  scopeLists: [
    { key: 'area', sphere: 'area' },
    { key: 'segment', sphere: 'segmento' },
    { key: 'network', sphere: 'rede' },
  ],
  scopeListWords: { area: 'area', segment: 'segmento', network: 'rede' },
  scopeCardClass: { area: '', segmento: 'card-sector', rede: 'card-network' },
  /** Theme-only scene overrides (the institution keeps the shared defaults). */
  acervoScene: {
    stats: [
      { key: 'universe', label: 'Universo recuperado' },
      { key: 'sample', label: 'Amostra exibida' },
    ],
    columns: ['Data', 'Tema canônico', 'Trecho/contexto', 'Abrangência', 'Link'],
    alert:
      'O tema prova pertinência ao recorte do acervo; não prova por si só entrega, autoria material ou execução financeira.',
  },
  reachScene: {
    columns: ['Item', 'Era / ano', 'Valor / fase', 'Evidência temática', 'Fonte'],
    tableClass: 'document-table--reach',
  },
  gapsScene: {
    columns: ['Era', 'Lacuna', 'Já consultado', 'Próxima busca', 'Status'],
    alert:
      'Portais que não filtram por área não autorizam atribuição. Sem fonte temática, a linha permanece lacuna — nunca zero.',
  },
  sourcesHierarchy: [
    {
      layer: 'Fontes primárias',
      use: 'Atos, diários oficiais e documentos contemporâneos',
      limit: 'Sem documento, não entra',
    },
    {
      layer: 'Fontes institucionais',
      use: 'Portais oficiais e de transparência',
      limit: 'Não filtram por área',
    },
    {
      layer: 'Acervo interno',
      use: 'Falas classificadas por tema (2011+)',
      limit: 'Prova pertinência, não entrega',
    },
    {
      layer: 'Busca web datada',
      use: 'Notícias e publicações com data',
      limit: 'Resultado não prova ausência',
    },
  ],
  /** Síntese/rótulos temáticos (institution/município keep the shared literals). */
  byAreaTitle: 'Tipos de atuação com mais registros',
  byYearTitle: 'Pontos com fonte por ano',
  fullYearAxis: true,
  eraCoverageFromLedger: true,
  moneyPhaseStyle: 'separate',
  /**
   * Theme bulletins read the year when a fact has no money value, and mark the
   * card textual when neither exists (never a fake zero).
   */
  bulletinNumberFallback: true,
  eraMethod: {
    A: 'Registros anteriores a 2007 que tratem diretamente da área ou comprovem atuação relacionada. Cargo geral não prova ação na política.',
    B: 'A gestão estadual é lida por programa, projeto, convênio e obra ligados à área; cada linha informa abrangência e fonte. Segmento e rede não somam à área.',
    C: 'Mandato, relatorias e execução financeira têm datas e estágios distintos. Empenho não é pagamento; o valor sempre acompanha a fase.',
  },
  eraRecovery: {
    A: 'biografias oficiais · atos e diários · acervos de políticas públicas · busca web datada',
    B: 'DOE-BA (DOOL) · notícias SESAB · Transparência Bahia · SIOPS/DATASUS · busca web datada',
    C: 'API Câmara · Portal da Transparência · acervo interno read-only · busca web datada',
  },
  identityBadges: (identity) => [identity.label].filter(Boolean),
  /** Theme bulletin pills: recorte label, canonical token (mono) and taxonomy origin. */
  bulletinPills: (identity) => [
    { label: 'Área' },
    { label: identity.value, code: true },
    { label: identity.taxonomyNote ?? 'Taxonomia do acervo' },
  ],
  identityRows: (identity) =>
    [
      ['Área', identity.label],
      ['Token', identity.value],
      ['Origem', identity.taxonomyNote ?? 'Taxonomia do acervo'],
      ['Filtro', 'Speech.topics'],
    ].filter(([, value]) => Boolean(value)),
  coverRows: (report) => [
    { label: 'Área', badges: report.meta.identityBadges },
    {
      label: 'Valor canônico',
      code: report.meta.identity?.value,
      note: 'taxonomia do acervo / Speech.topics',
    },
  ],
  copy: {
    coverSubtitle: (subjectName) =>
      `O que Jorge Solla fez ${themeSubjectPhrase(subjectName)} ao longo da carreira`,
    coverHowToUse:
      'Localize a entrega, confira fonte, data, fase e abrangência. A área vem da taxonomia canônica; segmento e rede não são somados a ela.',
    coverScope:
      'Escopo: carreira técnica e gestão pública até 2006 · SESAB 2007–2014 · Câmara 2015–2027. Área, segmento e rede separados; sem fonte, não entra como entrega.',
    coverScopeWords: 'área, segmento e rede separados',
    coverAsset: ['selo autorizado', 'e origem'],
    openingTitle: (subjectName) => `O que Jorge Solla fez ${themeSubjectPhrase(subjectName)}`,
    reachRuleTitle: 'Segmento/rede não é a área. Não some os recortes.',
    reachRuleBody:
      'Uma ação dirigida a um segmento ou a uma rede pode alcançar a política de área sem constituir entrega exclusiva dela.',
    synthesisGuard: 'segmento e rede nunca somados à área.',
    coverageNote: 'Área, segmento e rede separados; sem fonte, não entra como entrega.',
    timelineEmpty: 'Nenhum vínculo datado com fonte — ver lacunas explícitas.',
    eraEmpty: {
      body: 'A pesquisa não encontrou documento que sustente uma afirmação sobre a área. Isso não prova ausência de atuação; prova apenas que o dossiê ainda não pode afirmá-la.',
      work: [
        'Busca pelo tema canônico e termos correlatos.',
        'Consulta a fontes oficiais e acervos datados.',
        'Triagem de resultados por atribuição à área.',
        'Descarte de menções sem lastro suficiente.',
      ],
      todo: [
        'Solicitar consulta a acervo especializado.',
        'Validar a taxonomia e o recorte do tema.',
        'Recuperar ato, publicação ou documento contemporâneo.',
        'Repetir busca com termos correlatos.',
      ],
      rule: (eraLabel) =>
        `Não preencher a seção por memória, cargo provável ou tema vizinho. Registrar “${eraLabel}: evidência da área não localizada nas fontes consultadas”.`,
    },
    limits: {
      coverage: [
        'O acervo interno de falas cobre 2011+; períodos anteriores dependem de fontes externas.',
        'Resultado de busca não prova ausência histórica.',
        'Emenda de bancada ou relator só recebe autoria quando a fonte a confirma.',
        'Menção a segmento ou rede não é atribuição exclusiva da área.',
      ],
      editorial: [
        'Sem fonte, não publica.',
        'URL e data acompanham cada afirmação não trivial.',
        'Área, segmento e rede permanecem separados.',
        'Valor sempre informa a fase de execução.',
        'Atribuição temática a emenda ou proposição só entra com fonte; sem fonte, vira lacuna.',
      ],
    },
    mdAcervoNote: 'Recorte pela tag do acervo, não nominal.',
    bulletin: {
      aria: 'Modelo de boletim informativo temático de uma página',
      openingLabel: 'Uma trajetória de trabalho pela área',
      openingTitle: (subjectName) => `O que Jorge Solla fez ${themeSubjectPhrase(subjectName)}`,
      lead: 'Ações, recursos e articulações explicados de forma direta — somente o que já foi documentado no dossiê da área.',
      leadSparse:
        'Esta versão tem poucos registros confirmados. Em vez de preencher espaço, mostra só os fatos que o dossiê sustenta.',
      asset: 'Solla na ação citada',
      assetSparse: 'somente registro relacionado ao fato',
      assetSelo: ['selo autorizado', 'arquivo vetorial'],
      assetClipping: ['registro real da ação', 'origem e licença'],
      moreEmpty: 'Conferir as lacunas explícitas no dossiê da área antes de ampliar o boletim.',
      defeso:
        'fase acompanha cada valor · área, segmento e rede não são somados · sem percentual estadual absoluto.',
      orig: 'Conteúdo selecionado do dossiê da área.',
      remaining: 'no dossiê da área — o boletim de uma página não os exibe.',
      sparseRule:
        'Não repetir item, não ampliar efeito e não preencher com ação de segmento ou rede como se fosse entrega exclusiva da área.',
      title: 'Uma trajetória de compromisso com o serviço público',
      titleSparse: 'contexto de carreira · não substitui fato da área',
      highlightsTitle: 'Resultados em leitura rápida',
      highlightsTitleSparse: 'Poucos fatos, sem enchimento',
      moreTitle: 'Outras ações confirmadas',
      moreTitleSparse: 'Outros registros confirmados',
    },
  },
}

const DOSSIER_UNITS = {
  municipality: MUNICIPALITY_UNIT,
  institution: INSTITUTION_UNIT,
  theme: THEME_UNIT,
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

/** Institution and theme share the `subject` shape (one builder/renderer). */
export const isSubjectUnit = (unit) => resolveDossierUnit(unit).shape === 'subject'
