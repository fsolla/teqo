import type { Metadata } from 'next'

import { CAMPAIGN_HOME, CAMPAIGN_UPDATES_HREF, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { normalizePathname } from '@/lib/campaignQuickActionPaths'
import type { CampaignUser } from '@/payload-types'

export type CampaignPageChrome = {
  title: string
  subtitle?: string
}

type CampaignRole = CampaignUser['role']

/** Client-safe vocabulary for shell chrome and tab titles (B123). */
export const campaignPageChromeCatalog = {
  home: null,
  quadro: {
    title: 'Quadro',
  },
  municipios: {
    title: 'Municípios',
  },
  territorios: {
    title: 'Territórios de Identidade',
  },
  liderancas: {
    title: 'Lideranças',
  },
  liderancasNova: {
    title: 'Nova liderança',
  },
  dobradinhas: {
    title: 'Dobradinhas',
  },
  dobradinhasNova: {
    title: 'Nova dobradinha',
  },
  atividades: {
    title: 'Atividades',
  },
  agenda: {
    title: 'Agenda',
  },
  atividadesNova: {
    title: 'Nova atividade',
  },
  atividadesGiros: {
    title: 'Planejar giro',
  },
  demandas: {
    title: 'Demandas',
  },
  demandasNova: {
    title: 'Nova demanda',
  },
  apoiadores: {
    title: 'Apoiadores',
  },
  apoiadoresNovo: {
    title: 'Novo apoiador',
  },
  apoiadoresImportar: {
    title: 'Importar apoiadores via CSV',
  },
  assessores: {
    title: 'Assessores',
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
  atualizacoes: {
    title: 'Atualizações',
  },
  contatos: {
    title: 'Contatos',
    subtitle: 'Cadastre apoiadores pelo celular. Só você vê os contatos que criou aqui.',
  },
  perfil: {
    title: 'Meu perfil',
    subtitle: 'Gerencie sua foto, sua senha e a entrada por biometria.',
  },
} as const satisfies Record<string, CampaignPageChrome | null>

const resolveCatalogEntry = (
  entry: (typeof campaignPageChromeCatalog)[keyof typeof campaignPageChromeCatalog],
): CampaignPageChrome | null => {
  if (!entry) return null
  return 'subtitle' in entry && entry.subtitle
    ? { title: entry.title, subtitle: entry.subtitle }
    : { title: entry.title }
}

type PathRule = {
  match: (pathname: string) => boolean
  resolve: () => CampaignPageChrome | null
}

const pathRules: PathRule[] = [
  {
    match: (pathname) => pathname === CAMPAIGN_HOME,
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/quadro',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.quadro),
  },
  {
    match: (pathname) => pathname === '/campanha/municipios',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.municipios),
  },
  {
    match: (pathname) => /^\/campanha\/municipios\/[^/]+\/editar$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => /^\/campanha\/municipios\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    // B147 parallel v2 — soft-dep B145 for entity name in chrome; section title for now.
    match: (pathname) => /^\/campanha\/municipio\/[^/]+\/v2$/.test(pathname),
    resolve: () => ({ title: campaignPageChromeCatalog.municipios.title }),
  },
  {
    match: (pathname) => pathname === '/campanha/territorios',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.territorios),
  },
  {
    match: (pathname) => pathname === '/campanha/liderancas/nova',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.liderancasNova),
  },
  {
    match: (pathname) => /^\/campanha\/liderancas\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/liderancas',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.liderancas),
  },
  {
    match: (pathname) => pathname === '/campanha/dobradinhas/nova',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.dobradinhasNova),
  },
  {
    match: (pathname) => /^\/campanha\/dobradinhas\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/dobradinhas',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.dobradinhas),
  },
  {
    match: (pathname) => pathname === '/campanha/agenda',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.agenda),
  },
  {
    match: (pathname) => pathname === '/campanha/atividades/nova',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.atividadesNova),
  },
  {
    match: (pathname) => pathname === '/campanha/atividades/giros',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.atividadesGiros),
  },
  {
    match: (pathname) => /^\/campanha\/atividades\/[^/]+\/editar$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => /^\/campanha\/atividades\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/atividades',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.atividades),
  },
  {
    match: (pathname) => pathname === '/campanha/demandas/nova',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.demandasNova),
  },
  {
    match: (pathname) => /^\/campanha\/demandas\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/demandas',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.demandas),
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores/novo',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.apoiadoresNovo),
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores/importar',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.apoiadoresImportar),
  },
  {
    match: (pathname) => /^\/campanha\/apoiadores\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/apoiadores',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.apoiadores),
  },
  {
    match: (pathname) => /^\/campanha\/assessores\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/assessores',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.assessores),
  },
  {
    match: (pathname) => pathname === '/campanha/organizacoes/nova',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.organizacoesNova),
  },
  {
    match: (pathname) => /^\/campanha\/organizacoes\/[^/]+$/.test(pathname),
    resolve: () => null,
  },
  {
    match: (pathname) => pathname === '/campanha/organizacoes',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.organizacoes),
  },
  {
    match: (pathname) => pathname === '/campanha/conceitos',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.conceitos),
  },
  {
    match: (pathname) => pathname === CAMPAIGN_UPDATES_HREF,
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.atualizacoes),
  },
  {
    match: (pathname) => pathname === LEADER_CONTACTS_HOME,
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.contatos),
  },
  {
    match: (pathname) => pathname === '/campanha/perfil',
    resolve: () => resolveCatalogEntry(campaignPageChromeCatalog.perfil),
  },
]

export const resolveCampaignPageChrome = (
  pathname: string,
  _role: CampaignRole,
): CampaignPageChrome | null => {
  const normalized = normalizePathname(pathname)
  for (const rule of pathRules) {
    if (rule.match(normalized)) {
      return rule.resolve()
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
): Metadata => campaignPageMetadata(resolveCatalogEntry(campaignPageChromeCatalog[key]))
