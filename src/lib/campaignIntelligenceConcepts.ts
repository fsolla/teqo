/**
 * E18 — curated documentation of the campaign-intelligence numbers the product
 * derives, rendered by `/campanha/conceitos` and linked from the tooltips that
 * expose each number.
 *
 * Content lives here, in code, next to the formulas it describes (E8:
 * `municipalityPotential.ts` / `goalCoverage.ts`) so a change to a formula and
 * the change to its explanation land in the same review — a Payload collection
 * would let the copy drift silently. Every entry must describe what the code
 * actually computes; when a formula changes, this text changes with it.
 *
 * v1 covers the E8 "conta da cadeira" numbers; E10 added dominância relativa
 * and a classe territorial; B13 added the two map scales that are not just a
 * re-rendering of an existing number (quantis and posição no município — LQ is
 * already documented as dominância relativa). Each later slice of the
 * intelligence program (E11 sugestões, E12 TI, E13 giros, E14 níveis) appends
 * its own entries as part of its own delivery.
 */

export type CampaignConceptId =
  | 'votos-validos-projetados'
  | 'teto-do-campo'
  | 'captura'
  | 'share-intracampo'
  | 'roll-off'
  | 'dominancia-relativa'
  | 'classe-territorial'
  | 'nivel-de-envolvimento'
  | 'quantis-do-mapa'
  | 'posicao-no-municipio'
  | 'meta'
  | 'cobertura-da-meta'
  | 'captura-regional'
  | 'benchmark-intra-ti'
  | 'elegibilidade-para-visita'
  | 'fase-do-calendario'
  | 'triagem-de-sugestoes'
  | 'pauta-do-silencio'

export type CampaignConceptCategoryId = 'base' | 'diagnostico' | 'meta'

export type CampaignIntelligenceConcept = {
  id: CampaignConceptId
  categoryID: CampaignConceptCategoryId
  title: string
  /** One sentence: what the number measures. */
  oneLiner: string
  /** How it is calculated, in plain text (never rendered as math notation). */
  formula: string
  /** Hand-written illustration; never computed from live data. */
  example?: string
  /** What decision the number supports — including when it supports none. */
  whyItMatters: string
  /** Where in `/campanha` the number is shown. */
  whereItAppears: string
}

export const CAMPAIGN_CONCEPT_CATEGORIES: ReadonlyArray<{
  id: CampaignConceptCategoryId
  label: string
}> = [
  { id: 'base', label: 'Base do cálculo' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'meta', label: 'Meta e cobertura' },
]

export const campaignIntelligenceConcepts: ReadonlyArray<CampaignIntelligenceConcept> = [
  {
    id: 'votos-validos-projetados',
    categoryID: 'base',
    title: 'Votos válidos projetados',
    oneLiner: 'Quantos votos válidos a disputa de deputado federal deve ter no município em 2026.',
    formula:
      'válidos projetados = (válidos 2014 + válidos 2018 + 2 × válidos 2022) ÷ 4, sobre o 1º turno de deputado federal.',
    example:
      'Um município com 20.000 válidos em 2014, 22.000 em 2018 e 24.000 em 2022 projeta (20.000 + 22.000 + 2 × 24.000) ÷ 4 = 22.500.',
    whyItMatters:
      'É a régua de tamanho do município: entra no teto do campo projetado e, por consequência, na meta sugerida. 2022 pesa o dobro por ser a eleição mais próxima. É uma fórmula fixa e auditável, não uma previsão estatística — o produto não faz modelo de votos.',
    whereItAppears:
      'Não aparece como número na tela; sustenta o teto do campo projetado e a meta sugerida.',
  },
  {
    id: 'teto-do-campo',
    categoryID: 'base',
    title: 'Teto do campo (projetado)',
    oneLiner:
      'Quantos votos o campo (PT e aliados de esquerda) pode alcançar no município em 2026.',
    formula:
      'teto 2022 = votos do presidencial do campo no município (1º turno de 2022). Teto projetado = teto 2022 × (válidos projetados ÷ válidos de 2022).',
    example:
      'Teto de 12.000 votos em 2022 num município que projeta crescer 5% de válidos vira um teto projetado de 12.600.',
    whyItMatters:
      'A disputa majoritária mostra o tamanho real do campo no município — muito maior do que a eleição fragmentada de deputado federal consegue revelar. É o denominador da captura e o peso usado para decompor a meta estadual. Usa só 2022: a majoritária de 2014 e 2018 já foi importada, mas ainda não entra nestas contas.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Teto do campo (proj.)").',
  },
  {
    id: 'captura',
    categoryID: 'diagnostico',
    title: 'Captura (2022)',
    oneLiner: 'Quanto do teto do campo o Jorge Solla efetivamente conquistou no município em 2022.',
    formula: 'captura = votos de Solla para deputado federal em 2022 ÷ teto do campo de 2022.',
    example: '1.200 votos de Solla sobre um teto de 12.000 = 10% de captura.',
    whyItMatters:
      'Separa "município pequeno" de "município onde o campo é grande e a campanha não chegou". Captura baixa com teto alto é espaço a ocupar; captura alta é base a defender. É só diagnóstico: não entra no cálculo da meta, para não premiar o que já está consolidado nem punir onde ainda não se trabalhou.',
    whereItAppears:
      'Card "Conta da cadeira", no detalhe do município ("Captura (2022)"), e a coluna "Captura" em `/campanha/territorios`.',
  },
  {
    id: 'captura-regional',
    categoryID: 'diagnostico',
    title: 'Captura regional (território)',
    oneLiner:
      'Quanto do teto do campo o Jorge Solla conquistou em 2022, somando todos os municípios do Território de Identidade.',
    formula:
      'captura do TI = Σ votos de Solla (2022) nos municípios do território ÷ Σ tetos do campo (2022) nos mesmos municípios. A mediana e a amplitude vêm das capturas município a município — só para leitura, nunca como substituto do agregado.',
    example:
      'Dois municípios com 10% e 50% de captura não têm "30% no território" se os tetos forem muito diferentes — o número certo é a soma dos votos ÷ soma dos tetos.',
    whyItMatters:
      'Evita a média que mente (MAUP): uma média de percentuais esconde onde o campo é grande e a campanha não chegou. O agregado do território sempre vem com mediana, amplitude e município crítico (maior déficit de meta) a um clique.',
    whereItAppears: 'Coluna "Captura" em `/campanha/territorios` (tooltip com decomposição).',
  },
  {
    id: 'benchmark-intra-ti',
    categoryID: 'diagnostico',
    title: 'Benchmark intra-TI (captura)',
    oneLiner:
      'Compara a captura deste município com a mediana dos pares no mesmo Território de Identidade.',
    formula:
      'razão = captura do município ÷ mediana das capturas dos municípios do mesmo TI (Salvador compara só com as 19 zonas; demais RMS só entre si).',
    example:
      'Captura 12% com mediana 6% no TI = 2× a mediana — mecanismo acima do padrão local, não "nota".',
    whyItMatters:
      'Responde se o município rende acima ou abaixo do que o próprio território já mostrou possível — aprendizado de mecanismo, não régua punitiva entre TIs.',
    whereItAppears:
      'Parágrafo abaixo de "Captura (2022)" no card "Conta da cadeira" do detalhe do município.',
  },
  {
    id: 'share-intracampo',
    categoryID: 'diagnostico',
    title: 'Share intracampo',
    oneLiner:
      'Dos votos que o campo recebeu para deputado federal naquele ano, a fração que foi para Jorge Solla.',
    formula:
      'share intracampo = votos de Solla no ano ÷ votos de todos os partidos do campo para deputado federal no mesmo ano.',
    whyItMatters:
      'É a leitura do fogo amigo: o denominador é o próprio campo na mesma disputa, então o número mostra a divisão interna do voto de esquerda no município, ano a ano (2014, 2018, 2022). Diferente da captura, cujo denominador é o teto presidencial de 2022. O campo é uma lista curada de siglas por ano (2022 e 2026: PT, PC do B, PV), não a coligação registrada no TSE — coligações proporcionais juntam aliados sem afinidade só para somar quociente.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Share intracampo").',
  },
  {
    id: 'roll-off',
    categoryID: 'diagnostico',
    title: 'Roll-off (2022)',
    oneLiner:
      'Quanto voto em branco e nulo a disputa de deputado federal atraiu a mais que a presidencial, no mesmo comparecimento.',
    formula:
      'roll-off = (brancos + nulos de deputado federal em 2022) − (brancos + nulos do presidencial em 2022). O percentual mostra esse saldo sobre o comparecimento de deputado federal.',
    whyItMatters:
      'Mede quanto eleitor comparece, vota para presidente e desiste de escolher deputado. Roll-off alto indica eleitorado disponível para quem chegar com nome e razão para votar — mas é diagnóstico de contexto, não um reservatório de votos garantidos. Também usa só 2022.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Roll-off (2022)").',
  },
  {
    id: 'dominancia-relativa',
    categoryID: 'diagnostico',
    title: 'Dominância relativa',
    oneLiner:
      'Quanto o desempenho do Jorge Solla no município se afasta do padrão dele no estado inteiro.',
    formula:
      'dominância = (votos de Solla ÷ votos válidos do município, em 2022) ÷ (votos de Solla ÷ votos válidos da Bahia, em 2022). Acima de 1 é acima do padrão dele; abaixo de 1 é abaixo.',
    example:
      'Um município onde ele fez 4% dos válidos, quando o padrão estadual dele é 2%, tem dominância 2 — "aqui rendemos o dobro do nosso normal". Onde ele fez 1,2%, a dominância é 0,6: "aqui rendemos 40% abaixo do nosso padrão".',
    whyItMatters:
      'Em deputado federal, o percentual absoluto engana: 3% dos válidos parece pouco e pode ser o melhor município da campanha. A comparação útil é com o próprio padrão, não com 50% + 1 — que é conta de eleição majoritária. É a leitura que separa "pequeno" de "fraco".',
    whereItAppears:
      'Como o "por quê" da classe, no card "Conta da cadeira", na capa do dossiê e na coluna "Classe" da lista de municípios.',
  },
  {
    id: 'classe-territorial',
    categoryID: 'diagnostico',
    title: 'Classe do município',
    oneLiner: 'Uma palavra para o que o município pede: Reduto, Expansão, Manutenção ou Marginal.',
    formula:
      'Reduto = dominância 2 ou mais. Marginal = dominância abaixo de 0,5 com pouco voto do campo sem captura (abaixo da mediana dos 435 municípios). Expansão = dominância abaixo de 0,5 mas com campo grande sem captura, ou município do bloco que concentra metade da votação dele. Manutenção = o meio, entre 0,5 e 2. Sem base = município sem série do TSE.',
    example:
      'Dominância 0,3 com 9.000 votos do campo sem captura é Expansão: o campo está lá e a campanha não chegou. A mesma dominância com 300 votos do campo disponíveis é Marginal — não compensa a perna.',
    whyItMatters:
      'Responde onde a perna vai na semana: defender reduto dormente ou abrir rede em expansão. A classe é sugestão, não sentença — ela nunca aparece sozinha, sempre com os dois fatores que a produziram, e a mesa pode decidir contra ela. Os cortes exatos (2 e 0,5) são ilustrativos: valem até o backtest contra 2014–2022 calibrá-los.',
    whereItAppears:
      'Card "Conta da cadeira" e capa do dossiê, no detalhe do município, coluna "Classe" da lista de municípios (com filtro e ordenação), e coluna "Classe" em `/campanha/territorios`.',
  },
  {
    id: 'nivel-de-envolvimento',
    categoryID: 'diagnostico',
    title: 'Nível de envolvimento (N0–N4)',
    oneLiner:
      'Quanto a campanha decidiu investir neste município: N0 monitorar, N1 presença de mandato, N2 rede sem agenda, N3 rede com agenda, N4 investimento pleno.',
    formula:
      'Não é calculado: é declarado pela coordenação geral. Todo movimento fica registrado em Decisões de alocação com o nível anterior, o novo, a data e um motivo opcional. Três regras seguram a oscilação: pular dois níveis de uma vez só com choque triangulado, não rebaixar um nível decidido há menos de três semanas, e um movimento por mês. A coordenação pode passar por cima delas — o override é gravado com as regras que contrariou.',
    example:
      'Um município em N1 que recebeu rede e entrou na agenda de giro sobe para N3; nas três semanas seguintes um pedido de rebaixamento fica bloqueado até a janela de proteção fechar, salvo override justificado.',
    whyItMatters:
      'Separa o que a campanha SABE sobre o município (classe, captura, cobertura da meta) do que a campanha DECIDIU fazer nele. Sem esse registro, a alocação de presença vira memória de reunião: ninguém sabe quem prometeu o quê nem por quê. Os cortes das regras de estabilidade são ilustrativos até o backtest calibrá-los.',
    whereItAppears:
      'Coluna "Nível" da lista de municípios (com filtro, ordenação e edição pela coordenação) e bloco de estratégia no detalhe do município.',
  },
  {
    id: 'elegibilidade-para-visita',
    categoryID: 'diagnostico',
    title: 'Elegibilidade para visita',
    oneLiner:
      'Cinco condições que dizem se vale gastar um dia da agenda do candidato no município.',
    formula:
      'Volume: válidos projetados acima da mediana dos 435 municípios. Espaço para crescer: déficit de meta positivo, ou voto do campo sem captura acima da mediana. Rede de recepção: ao menos um assessor responsável E ao menos uma liderança ou um compromisso. Janela política: dobradinha estadual vinculada, ou tendência política registrada como favorável ou neutra. Encaixe em giro: ao menos um outro município do mesmo Território de Identidade com liderança ou compromisso — parada possível na mesma viagem.',
    example:
      'Um município grande, com déficit de meta, assessor e três lideranças, mas sem dobradinha e com tendência não registrada, fecha quatro de cinco: a condição que falta é a janela, e ela é acionável (registrar a conjuntura ou casar uma dobradinha).',
    whyItMatters:
      'A visita rende o que a rede local converte dela — sem quem receba, o dia do candidato vira foto. Por isso a leitura é uma checklist, e nunca uma nota de 0 a 100: um número composto esconde qual condição falta e cria confiança que o dado não sustenta. Exigir as cinco é o critério; a contraindicação ("não recomendado agora") é aviso com contra-oferta, jamais bloqueio — a coordenação decide contra ela quando a política pede. Os cortes são ilustrativos até o backtest calibrá-los.',
    whereItAppears:
      'Card "Elegibilidade para visita" no detalhe do município e a lista de candidatas no compositor de giros (`/campanha/atividades/giros`).',
  },
  {
    id: 'fase-do-calendario',
    categoryID: 'diagnostico',
    title: 'Fase do calendário',
    oneLiner: 'Em que etapa da campanha estamos — e, por consequência, para que serve uma visita.',
    formula:
      'Construção até 15/08 (véspera da abertura legal da propaganda), Consolidação de 16/08 a 27/09, Ativação de 28/09 até a votação em 04/10. A virada acontece à meia-noite no fuso da Bahia.',
    example:
      'A mesma reunião com lideranças é o produto certo em agosto e o produto errado na última semana, quando o dia rende mais em ato e mobilização de quem já está com a campanha.',
    whyItMatters:
      'A fase muda o produto da visita, não apenas a urgência: em julho ela existe para montar rede, em setembro para fechar compromissos e casar dobradinha, na última semana para mobilizar quem já decidiu. Sem esse rótulo, a agenda repete em outubro o formato que fazia sentido em julho. As duas datas de virada são âncoras reais (abertura da propaganda e véspera da eleição); o corte exato entre consolidação e ativação é decisão da coordenação.',
    whereItAppears:
      'Card "Elegibilidade para visita" no detalhe do município e o cabeçalho do compositor de giros.',
  },
  {
    id: 'quantis-do-mapa',
    categoryID: 'diagnostico',
    title: 'Quantis (escala do mapa)',
    oneLiner:
      'Divide os municípios em cinco faixas com o mesmo número de municípios cada, da menor votação para a maior.',
    formula:
      'Ordena os municípios do seu escopo que tiveram votos e corta a lista em cinco partes iguais em QUANTIDADE de municípios. Cada faixa da legenda mostra o menor e o maior valor real que caíram nela. Com menos de 10 municípios em tela a escala cai para três faixas, e a legenda avisa.',
    example:
      'Com 415 municípios, cada faixa tem cerca de 83. A faixa mais escura pode ir de 267 a 27.264 votos — as distâncias entre faixas não são iguais, o número de municípios é.',
    whyItMatters:
      'Numa disputa de deputado federal, uma escala de 0 a 100% pinta a Bahia inteira de uma cor só: o melhor município dele dá menos de 5% dos válidos de lá. O quantil sempre usa a paleta inteira, então o mapa volta a discriminar. O preço é que a cor é relativa ao conjunto em tela — não compare a cor de uma carteira de assessor com a cor do mapa estadual.',
    whereItAppears: 'Mapa dos Municípios, no Início — é a escala padrão.',
  },
  {
    id: 'posicao-no-municipio',
    categoryID: 'diagnostico',
    title: 'Posição no município',
    oneLiner:
      'Em que lugar o Jorge Solla ficou entre todos os candidatos a deputado federal votados naquele município.',
    formula:
      'Ordena todos os candidatos a deputado federal por votos no município (1º turno do ano escolhido) e lê a colocação dele. Vale para a cidade inteira: em Salvador, as 19 zonas dividem a mesma posição, porque o mapa desenha a cidade e não a zona.',
    example:
      '5.005 votos em Vitória da Conquista o colocaram em 6º entre 663 candidatos votados lá.',
    whyItMatters:
      'É a leitura de competição que falta nas outras escalas: dominância compara ele com ele mesmo, e a posição compara ele com quem disputa a mesma cadeira ali. Ser 1º num município pequeno é uma relação política concreta; ser 40º num município grande diz que o voto está pulverizado. Só existe para anos com resultado do TSE — 2026 não tem posição.',
    whereItAppears: 'Mapa dos Municípios, no Início (escala "Posição no município").',
  },
  {
    id: 'meta',
    categoryID: 'meta',
    title: 'Meta e meta sugerida',
    oneLiner: 'Quantos votos a campanha quer no município no cenário escolhido.',
    formula:
      'meta = estimativa da mesa para o cenário (pessimista, média ou otimista), quando existe; sem estimativa, usa a meta sugerida. Meta sugerida = meta estadual × (teto do campo projetado do município ÷ soma dos tetos projetados dos 435 municípios).',
    example:
      'Com meta estadual de 150.000 votos, um município que responde por 2% da soma dos tetos projetados recebe uma meta sugerida de 3.000.',
    whyItMatters:
      'A estimativa da mesa sempre vence a sugestão: quem conhece o município decide. A meta sugerida existe para que nenhum dos 435 municípios fique sem régua enquanto a mesa não preencher. A decomposição é proporcional só ao teto projetado — captura e share ficam de fora de propósito, como diagnóstico. A meta estadual (e a margem de segurança) é editada em Metas da campanha.',
    whereItAppears:
      'Card "Conta da cadeira" ("Meta usada na conta") e o campo de votos estimados no detalhe e na lista de municípios.',
  },
  {
    id: 'cobertura-da-meta',
    categoryID: 'meta',
    title: 'Cobertura da meta',
    oneLiner:
      'Quanto da meta já está coberto por compromissos de lideranças — não por expectativa da mesa.',
    formula:
      'cobertura = comprometido ÷ meta. Comprometido = soma dos votos das lideranças do município (estimativa do cenário quando existe, senão o número declarado pela liderança). Déficit = meta − comprometido.',
    example:
      'Meta de 3.000 com 1.200 votos comprometidos em lideranças = 40% de cobertura, déficit de 1.800.',
    whyItMatters:
      'É a diferença entre querer e ter: a expectativa da mesa define a meta, mas nunca conta como compromisso — se contasse, todo município com estimativa preenchida apareceria coberto sem uma única liderança por trás. O déficit descoberto é o que ordena onde a campanha precisa de mais rede.',
    whereItAppears:
      'Início (staff), visão geral e coluna "Cobertura" na lista de municípios, coluna "Cobertura da meta" em `/campanha/territorios`, e o card "Conta da cadeira" no detalhe.',
  },
  {
    id: 'triagem-de-sugestoes',
    categoryID: 'diagnostico',
    title: 'Triagem das sugestões (níveis 1–5)',
    oneLiner:
      'A ordem da fila de sugestões: risco confirmado primeiro, otimização por último — nunca um score.',
    formula:
      'Cada padrão do catálogo entra num nível fixo: 1 = estoque em risco confirmado (reduto com sinal de adversário registrado), 2 = falha de canal, 3 = cobertura zero onde a meta exige, 4 = janela de oportunidade, 5 = otimização e higiene. Empate dentro do nível é decidido por votos em jogo (déficit da meta). Uma decisão registrada suprime o padrão por uma janela — exceto quando ele volta como nível 1.',
    example:
      'Um reduto do bloco central com sinal de invasão registrado entra no nível 1 e fura qualquer supressão; um município grande sem rede entra no nível 3 quando priorizado; pledges parados são nível 5 até o diagnóstico.',
    whyItMatters:
      'A precedência vem de custos assimétricos: estoque quase-certo em risco vale mais que oportunidade hipotética, e mediação quebrada não se recompra em semanas. A sugestão é sempre um menu para o julgamento do staff — o produto nunca decide sozinho, e cada decisão (inclusive a leitura descartada) fica registrada para o backtest.',
    whereItAppears:
      'Painel "Sugestões" no Início (staff) e card homônimo na visão geral do município.',
  },
  {
    id: 'pauta-do-silencio',
    categoryID: 'diagnostico',
    title: 'Pauta do silêncio',
    oneLiner:
      'Municípios priorizados onde nenhum padrão dispara e nada é registrado há mais de um mês — silêncio é pergunta, não conforto.',
    formula:
      'Entra na pauta o município com prioridade alta ou nível N2+ onde nenhum padrão do catálogo dispara E o último sinal registrado (atualização ou pledge) tem mais de um mês — ou nunca existiu.',
    example:
      'Um município priorizado sem atualização e sem pledge desde o início do ciclo aparece na pauta mesmo sem nenhum gatilho — a pergunta é se está tudo bem ou se ninguém está digitando.',
    whyItMatters:
      'O sistema só enxerga onde há rede registrando (viés da base): sem esta pauta, os desertos ficam mudos e o investimento se realimenta onde já há registro. A revisão mensal transforma a ausência de dado em pergunta explícita — e a resposta certa é auditar o registro, nunca despachar agenda.',
    whereItAppears: 'Faixa "Pauta do silêncio" no painel de sugestões do Início (staff).',
  },
]

export const campaignConceptsByCategory = (
  categoryID: CampaignConceptCategoryId,
): CampaignIntelligenceConcept[] =>
  campaignIntelligenceConcepts.filter((concept) => concept.categoryID === categoryID)

export const CAMPAIGN_CONCEPTS_PATH = '/campanha/conceitos'

/** Anchor href for a documented concept — typed so a renamed id can't leave a dead link behind. */
export const campaignConceptHref = (id: CampaignConceptId): string =>
  `${CAMPAIGN_CONCEPTS_PATH}#${id}`

/**
 * `oneLiner` indexed by id, built once at module init. Callers (e.g. the B22
 * column-header tooltips) quote the same sentence the glossary page shows
 * instead of writing a second, driftable one. The cast is the single place
 * that assumes every `CampaignConceptId` has a matching concept — the
 * "unique ids" test above pins that assumption for the whole union, so
 * `campaignConceptOneLiner` itself stays a plain, assertion-free lookup.
 */
const campaignConceptOneLinerByID = Object.fromEntries(
  campaignIntelligenceConcepts.map((concept) => [concept.id, concept.oneLiner]),
) as Record<CampaignConceptId, string>

export const campaignConceptOneLiner = (id: CampaignConceptId): string =>
  campaignConceptOneLinerByID[id]
