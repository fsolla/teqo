import { SECTION_STORY_TITLE } from '@/lib/sectionStoryRender'

/**
 * S46 — copy e links do `/potencial` (pt-BR; a página não coleta dado pessoal).
 * O link dos resultados aponta para o Portal de Dados Abertos do TSE — a mesma
 * fonte do artefato commitado; o autoatendimento é o caminho honesto de quem
 * não encontra a seção. O título e a hipótese são os MESMOS do story (dono:
 * `sectionStoryRender`), para a tela e a imagem nunca divergirem.
 */
export const POTENTIAL_PATH = '/potencial'

export const POTENTIAL_PAGE_EYEBROW = '2º turno · Eleição 2026'
export const POTENTIAL_NOT_FOUND_EYEBROW = 'Potencial da sua seção'
export const POTENTIAL_HEADLINE = SECTION_STORY_TITLE
export const POTENTIAL_INTRO =
  'Informe os dados do seu título de eleitor — UF, município, zona e seção — e veja o potencial de crescimento em pontos percentuais, do 1º para o 2º turno.'

export const TSE_RESULTS_URL = 'https://dadosabertos.tse.jus.br/dataset/resultados-2026'
export const TSE_SELF_SERVICE_URL =
  'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral'

export const POTENTIAL_SOURCE_PREFIX = 'Fonte: dados oficiais do TSE — 1º turno 2026 ·'
export const POTENTIAL_PRIVACY_NOTE = 'Sem cadastro: a consulta não pede nome, e-mail ou telefone.'

export const POTENTIAL_NOT_FOUND_TITLE = 'Não encontramos essa seção'
export const POTENTIAL_NOT_FOUND_MESSAGE =
  'Essa combinação de zona e seção não aparece nos dados do TSE.'
export const POTENTIAL_NOT_FOUND_HINT =
  'Confira os quatro dados no seu título de eleitor — é comum trocar a zona pela seção.'
export const POTENTIAL_NO_DATA_MESSAGE =
  'Essa seção não teve votos válidos para presidente no 1º turno de 2026.'
export const POTENTIAL_UNAVAILABLE_MESSAGE =
  'Não foi possível consultar os dados agora. Tente de novo em instantes.'
export const POTENTIAL_THROTTLED_MESSAGE =
  'Muitas consultas em sequência. Aguarde um instante e tente de novo.'

export const POTENTIAL_FORM_VALIDATION_MESSAGE =
  'Preencha UF, município, zona e seção — os quatro dados estão no seu título de eleitor.'

export const POTENTIAL_MUNICIPALITY_HELP =
  'Digite ao menos 3 letras. A lista mostra só municípios da UF escolhida.'
export const POTENTIAL_MUNICIPALITY_PICK = 'Escolha um município da lista.'
export const POTENTIAL_MUNICIPALITY_EMPTY = 'Nenhum município encontrado nesta UF.'
export const POTENTIAL_MUNICIPALITY_ERROR =
  'Não foi possível carregar a lista de municípios. Recarregue a página.'

export const POTENTIAL_LOADING_MESSAGE = 'Consultando os dados oficiais do TSE…'
export const POTENTIAL_LOADING_NOTE = 'Pode levar alguns segundos. Não feche a página.'

export const POTENTIAL_STORY_PREVIEW_NOTE =
  'A imagem final sai em 1080 × 1920 px (PNG), pronta para o story.'
export const POTENTIAL_STORY_SHARE_NOTE =
  'No celular, o compartilhamento abre a folha do sistema (Instagram, WhatsApp e outros). No computador, a imagem vai para a pasta de downloads — poste pelo app do Instagram.'
export const POTENTIAL_STORY_READY = 'Imagem pronta — 1080 × 1920 px'
export const POTENTIAL_STORY_EXPORT_FAILED =
  'Não foi possível gerar a imagem neste aparelho. Tente de novo.'

export const POTENTIAL_CHECK_LIST = [
  'UF e município do seu local de votação;',
  'zona eleitoral — 2 a 4 dígitos;',
  'seção — até 4 dígitos;',
  'se os números não estão invertidos (zona × seção).',
] as const
