import type { Metadata } from 'next'

import { CAMPAIGN_HOME, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import type { CampaignUser } from '@/payload-types'

export type CampaignPageChrome = {
  title: string
  subtitle?: string
}

type CampaignRole = CampaignUser['role']

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

const quadroSubtitle = (role: CampaignRole): string =>
  role === 'advisor'
    ? 'Quadro dos municípios sob sua assessoria.'
    : 'Quadro geral da campanha por município.'

/** Client-safe vocabulary for shell chrome and tab titles (B123). */
export const campaignPageChromeCatalog = {
  home: null,
  quadro: {
    title: 'Quadro',
    subtitle: quadroSubtitle,
  },
  municipios: {
    title: 'Municípios',
    subtitle:
      'Os 435 municípios da campanha: um por município da Bahia — em Salvador, uma zona eleitoral cada.',
  },
  territorios: {
    title: 'Territórios de Identidade',
    subtitle:
      'Compare a concentração histórica e a cobertura de assessoria das regiões da Bahia. Abra um território para ver seus municípios.',
  },
  liderancas: {
    title: 'Lideranças',
    subtitle: 'Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.',
  },
  liderancasNova: {
    title: 'Nova liderança',
    subtitle:
      'O contato é reaproveitado pelo celular quando já existe. Registre o consentimento antes de inserir dados reais.',
  },
  dobradinhas: {
    title: 'Dobradinhas',
    subtitle:
      'Deputados estaduais com quem a campanha dobra — vincule lideranças e municípios direto na lista.',
  },
  dobradinhasNova: {
    title: 'Nova dobradinha',
    subtitle:
      'Cadastre deputados estaduais com quem a campanha dobra. Vincule a municípios e lideranças nas fichas correspondentes.',
  },
  atividades: {
    title: 'Atividades',
    subtitle: 'Organize caminhadas, comícios, panfletagens e demais ações de campanha.',
  },
  atividadesNova: {
    title: 'Nova atividade',
    subtitle: 'Defina a ação, quando e onde ela acontece e quem responde por ela.',
  },
  atividadesGiros: {
    title: 'Planejar giro',
    subtitle:
      'Um giro por território: o ato onde o voto comprometido já está, as paradas com rede para receber, e uma semente de expansão para o giro não repetir só a base. A proposta é sugestão — você edita antes de gerar.',
  },
  demandas: {
    title: 'Demandas',
    subtitle:
      'Necessidades da campanha abertas pelas lideranças, revisadas pela assessoria e — quando preciso — decididas pelo Coordenador Geral.',
  },
  demandasNova: {
    title: 'Nova demanda',
    subtitle:
      'Descreva a necessidade (material, transporte, espaço, apoio…) e o município. A assessoria revisa e responde por aqui.',
  },
  apoiadores: {
    title: 'Apoiadores',
    subtitle: 'Base nominal de apoio com intenção de voto e vínculo opcional a municípios.',
  },
  apoiadoresNovo: {
    title: 'Novo apoiador',
    subtitle: 'Cadastre um apoiador com telefone obrigatório e consentimento LGPD.',
  },
  apoiadoresImportar: {
    title: 'Importar apoiadores via CSV',
    subtitle: 'Envie uma planilha, confira a prévia e confirme a importação em lote.',
  },
  assessores: {
    title: 'Assessores',
    subtitle:
      'Consulte na tabela; ative Editar para alterar campos e carteira. Nome abre a ficha; e-mail/celular copiam; município abre o município.',
  },
  organizacoes: {
    title: 'Organizações',
    subtitle:
      'Sindicatos, associações e movimentos que apoiam a campanha — com suas lideranças e atividades.',
  },
  organizacoesNova: {
    title: 'Nova organização',
    subtitle:
      'Cadastre sindicatos, associações, movimentos e afins para vincular lideranças e atividades.',
  },
  conceitos: {
    title: 'Conceitos de inteligência',
    subtitle:
      'O que cada número da campanha mede e como é calculado. Só o que o produto já calcula hoje — a lista cresce conforme novas análises entram.',
  },
  contatos: {
    title: 'Contatos',
    subtitle: 'Cadastre apoiadores pelo celular. Só você vê os contatos que criou aqui.',
  },
  perfil: {
    title: 'Meu perfil',
    subtitle: 'Gerencie sua foto, sua senha e a entrada por biometria.',
  },
} as const satisfies Record<
  string,
  CampaignPageChrome | { title: string; subtitle: (role: CampaignRole) => string } | null
>

const resolveCatalogEntry = (
  entry: (typeof campaignPageChromeCatalog)[keyof typeof campaignPageChromeCatalog],
  role: CampaignRole,
): CampaignPageChrome | null => {
  if (!entry) return null
  const subtitle =
    typeof entry.subtitle === 'function' ? entry.subtitle(role) : entry.subtitle
  return { title: entry.title, subtitle }
}

const sectionOnly = (title: string): CampaignPageChrome => ({ title })

type PathRule = {
  match: (pathname: string) => boolean
  resolve: (role: CampaignRole) => CampaignPageChrome | null
}

const pathRules: PathRule[] = [
  {
    match: (pathname) => pathname === CAMPAIGN_HOME,
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/quadro',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.quadro, role),
  },
  {
    match: (pathname) => pathname === '/campanha/municipios',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.municipios, role),
  },
  {
    match: (pathname) => /^\/campanha\/municipios\/[^/]+\/editar$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => /^\/campanha\/municipios\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.municipios.title),
  },
  {
    match: (pathname) => pathname === '/campanha/territorios',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.territorios, role),
  },
  {
    match: (pathname) => pathname === '/campanha/liderancas/nova',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.liderancasNova, role),
  },
  {
    match: (pathname) => /^\/campanha\/liderancas\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.liderancas.title),
  },
  {
    match: (pathname) => pathname === '/campanha/liderancas',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.liderancas, role),
  },
  {
    match: (pathname) => pathname === '/campanha/dobradinhas/nova',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.dobradinhasNova, role),
  },
  {
    match: (pathname) => /^\/campanha\/dobradinhas\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.dobradinhas.title),
  },
  {
    match: (pathname) => pathname === '/campanha/dobradinhas',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.dobradinhas, role),
  },
  {
    match: (pathname) => pathname === '/campanha/atividades/nova',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.atividadesNova, role),
  },
  {
    match: (pathname) => pathname === '/campanha/atividades/giros',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.atividadesGiros, role),
  },
  {
    match: (pathname) => /^\/campanha\/atividades\/[^/]+\/editar$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => /^\/campanha\/atividades\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.atividades.title),
  },
  {
    match: (pathname) => pathname === '/campanha/atividades',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.atividades, role),
  },
  {
    match: (pathname) => pathname === '/campanha/demandas/nova',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.demandasNova, role),
  },
  {
    match: (pathname) => /^\/campanha\/demandas\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.demandas.title),
  },
  {
    match: (pathname) => pathname === '/campanha/demandas',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.demandas, role),
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores/novo',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.apoiadoresNovo, role),
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores/importar',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.apoiadoresImportar, role),
  },
  {
    match: (pathname) => /^\/campanha\/apoiadores\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.apoiadores.title),
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.apoiadores, role),
  },
  {
    match: (pathname) => /^\/campanha\/assessores\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.assessores.title),
  },
  {
    match: (pathname) => pathname === '/campanha/assessores',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.assessores, role),
  },
  {
    match: (pathname) => pathname === '/campanha/organizacoes/nova',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.organizacoesNova, role),
  },
  {
    match: (pathname) => /^\/campanha\/organizacoes\/[^/]+$/.test(pathname),
    resolve: () => sectionOnly(campaignPageChromeCatalog.organizacoes.title),
  },
  {
    match: (pathname) => pathname === '/campanha/organizacoes',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.organizacoes, role),
  },
  {
    match: (pathname) => pathname === '/campanha/conceitos',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.conceitos, role),
  },
  {
    match: (pathname) => pathname === LEADER_CONTACTS_HOME,
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.contatos, role),
  },
  {
    match: (pathname) => pathname === '/campanha/perfil',
    resolve: (role) => resolveCatalogEntry(campaignPageChromeCatalog.perfil, role),
  },
]

export const resolveCampaignPageChrome = (
  pathname: string,
  role: CampaignRole,
): CampaignPageChrome | null => {
  const normalized = normalizePathname(pathname)
  for (const rule of pathRules) {
    if (rule.match(normalized)) {
      return rule.resolve(role)
    }
  }
  return null
}

const noIndexMetadata: Pick<Metadata, 'robots'> = {
  robots: { index: false, follow: false },
}

/** Tab title via `title.template` on `(campaign)/layout.tsx`. */
export const campaignPageMetadata = (chrome: CampaignPageChrome | null): Metadata => {
  if (!chrome) {
    return { title: 'Início', ...noIndexMetadata }
  }
  return { title: chrome.title, ...noIndexMetadata }
}

export const campaignPageMetadataFromCatalog = (
  key: keyof typeof campaignPageChromeCatalog,
  role: CampaignRole = 'coordinator',
): Metadata => campaignPageMetadata(resolveCatalogEntry(campaignPageChromeCatalog[key], role))
