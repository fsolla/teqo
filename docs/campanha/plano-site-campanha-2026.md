# Plano Geral — Site de Campanha Jorge Solla 1313 (2026)

> **Natureza deste documento:** plano **geral** do site de campanha (não é um
> plano de issue comum). Ele registra o contexto, as decisões de produto,
> design, conversão e engenharia, e as pendências. **A partir dele** serão
> gerados os planos de issue (`docs/plans/`) quando a equipe estiver pronta
> para implementar.
>
> Status: **rascunho de design/conversão em colaboração** (15/08/2026).
> Domínio de publicação: `jorgesolla1313.com.br` (vertical pública do Teqo).

---

## 1. Objetivo único da página

**Captar apoiador** — nome + WhatsApp + cidade — na reta final da campanha
(eleição: **04/10/2026**, 1º turno; hoje, 15/08, faltam ~50 dias).

- CTA primário: **WhatsApp com mensagem pré-configurada** (`wa.me`) e
  formulário de 3 campos no CTA final.
- Doação é canal **secundário** (link para `apoiar.me/jorgesolla`, homologado
  TSE) — o site nunca processa pagamento.

## 2. Faseamento (macro)

| Fase   | Escopo                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- |
| **v1** | Página única (landing) conforme wireframe — captação de apoiador + prova social + board IG/YT + CTA final |
| **v2** | Compartilhamento por seção (ver §7) + páginas próprias de proposta (SEO/AEO)                              |
| **v3** | (a definir: agenda/eventos, abaixo-assinados integrados, etc.)                                            |

## 3. Estrutura da página (10 seções — wireframe)

1. Header fixo (logo + 1313 + CTA âncora "Quero apoiar")
2. Hero (quem é + cargo + número + slogan "Um mandato do tamanho da Bahia" + CTA WhatsApp)
3. Prova social numérica (3 números verificados)
4. O problema (o que está em jogo no Congresso)
5. Bandeiras (6 cards — sem link "ler proposta", decisão do cliente; cada
   bandeira vira página própria de SEO/AEO na v2)
6. Quem é Jorge Solla (linha do tempo + **etiquetas de esfera** + formação e militância)
7. Acompanhe de perto (board de conteúdo IG + YouTube, bento 1 grande + 4 pequenos)
8. Depoimentos reais (NEEDS ASSET)
9. CTA final + formulário apoiador (3 campos) + doação secundária
10. Rodapé (identificação eleitoral, redes, privacidade)

Referência visual: [`wireframe-solla-1313.html`](./wireframe-solla-1313.html)
(mesmo diretório). Variantes de hero A/B/C documentadas no fim do arquivo.

## 4. Decisões registradas

### 4.1 Produto e conversão (doutrina de campanha 2026)

1. **Um CTA primário por página**; nunca dois de peso igual acima da dobra.
2. **Fase define o CTA**: na reta final, captar apoio primeiro; doação secundária.
3. **Formulário mínimo**: nome + WhatsApp + cidade; coleta progressiva; cada
   campo acima de 3 derruba conversão. **Nunca CPF/endereço na 1ª interação.**
4. **LGPD**: consentimento explícito (checkbox) + link de privacidade;
   consent por stable key (padrão do Teqo: `apoiador-cadastro`,
   `apoiador-intencao-voto` — fail-closed).
5. **WhatsApp com mensagem pré-configurada** = elemento de maior conversão em
   sites políticos brasileiros.
6. **Mobile-first** (maioria do tráfego é celular): inputs ≥16px (evita zoom
   iOS), alvos de toque ≥44px, carregamento <3s.
7. **Prova social com fonte**: números verificados na Câmara (13/08/2026):
   3.333 proposições (API Dados Abertos), 1.031 discursos (SitaqWeb), 3º
   mandato. "Sem fonte, não publica."
8. **Urgência ética**: só contagem regressiva real da eleição (04/10/2026).
9. **Diferencial central**: gestão nas três esferas (município → estado →
   União) — explícito no hero e na seção "Quem é" (lead + etiquetas de esfera
   na linha do tempo). Não há seção separada "diferencial" (decisão do cliente).
10. **Formação** (verificada): médico UFBA, mestre em Saúde Coletiva (UFBA),
    doutor em Clínica Médica (UFRJ), pesquisador do ISC-UFBA.
11. **Militância** (verificada): um dos fundadores do PT na Bahia, filiado
    desde 1980 (46 anos de partido), militante do SUS.
12. **Depoimentos sempre reais**, com nome completo e cidade — nunca inventar.
13. **Identificação eleitoral obrigatória** no rodapé: nome completo, nº 1313,
    federação (PT/PCdoB/PV), CNPJ da campanha.
14. **Copies revisados pelo agente solla-comunicacao (15/08/2026)** — decisões:
    - h1 usa o slogan oficial do mandato: **"Um mandato do tamanho da Bahia"**
      (presença no estado todo + amplitude saúde/educação; "Saúde é direito,
      não mercadoria" era bandeira comum a qualquer candidato do campo, não
      diferenciava).
    - "Saúde é direito, não mercadoria" **reaproveitada** como frase de abertura
      do card de proposta Saúde (a bandeira central não morre, desce do hero
      para o lugar onde o trabalhador da saúde procura).
    - Sub do hero reescrito para amplitude: feitos verificados + "leva o
      mandato aos 417 municípios, da saúde à educação".
    - Removido "SUS atende 8 em cada 10 brasileiros" (sem fonte no mandato —
      regra: sem fonte, não publica).
    - Variantes B/C ajustadas para tom factual ("Tem gente em Brasília
      querendo acabar com o SUS…" em vez de "O Congresso quer…").
15. **Regra de narrativa do momento (decisão do cliente, 15/08/2026)**: o
    governo atual é do PT e o candidato é do PT — a crítica ao momento existe
    para mostrar a luta por melhorar, mas **sempre pontuada pelo
    reconhecimento do que melhorou com Lula**. Enquadramento padrão:
    **avanço (reconhecimento) → obstáculo estrutural → por que a eleição
    importa**. O "vilão" nunca é o governo atual: são os limites fiscais
    herdados (teto de gastos da direita, o campo político de Temer) e um
    Congresso sem maioria aliada.
    Aplicado nos cards "Saúde subfinanciada" (Nova PAC R$ 30,5 bi + Mais
    Médicos retomado antes do problema), "Jornada que adoece" (vitória da
    bancada de Lula na Câmara contra a direita → briga no Senado, risco de
    adiamento de 10 anos) e "Mataripe nas mãos de estrangeiros" (título antigo
    "Bahia entregue ao atraso" rejeitado — ambiguidade de leitura "entregue
    pelo PT"; versão curta escolhida pelo cliente). TÍTULOS EM NOTAÇÃO DE
    BANDEIRA POSITIVA (decisão do cliente, 15/08): "Por um SUS com recursos!",
    "Pelo fim da escala 6x1!", "Pela recompra de Mataripe!" — três aberturas
    diferentes (Por um / Pelo fim / Pela) para não repetir construção na
    grade. Título da seção: "Eleger deputado é coisa séria. O Congresso tem
    nas mãos vidas reais e o SUS."
16. **Skill "humanize-ai-writing" instalada (15/08/2026)** em
    `~/.config/opencode/skills/humanize-ai-writing/` (fonte: github.com/haidrrrry/humanize-ai-writing,
    baseada no catálogo da Wikipedia "Signs of AI writing"). Passada final de
    humanização aplicada ao wireframe: 12 travessões de copy → ponto/dois-pontos
    (restam só os 2 aprovados + travessão legal TSE + placeholders de API);
    bullets "✔" → lista nativa (acessibilidade); zero vocabulário banido, zero
    tom promocional, zero conclusões ocas. Voz do mandato tem prioridade sobre
    as regras genéricas (zona cinza validada: "Saúde é direito, não mercadoria",
    "Reeleger Lula não basta…", "Médico, gestor, deputado", aspas tipográficas
    em depoimentos — todas mantidas de propósito).

### 4.2 Engenharia (stack Teqo)

- **Formulário apoiador** → segue o padrão do Teqo: `Contact` normalizado +
  join (ex.: `supporter`) + `Consent` por stable key; escrita transacional
  (`payload.db.beginTransaction` + `req.transactionID`); revalidação de cache
  via `afterChange`.
- **Select de cidade** usa os dados existentes (`src/lib/cities.ts` /
  `municipalityCatalog.ts` — 417 municípios, Salvador por zona eleitoral).
- **Board IG + YT** (decidido em 15/08):
  - Clique **abre direto na plataforma** (sem lightbox).
  - **YouTube automático**: Data API v3 (API key + channel ID no admin),
    server-side, cache ISR + revalidate periódico, thumbnails CDN, sem iframe
    no load.
  - **Instagram automático**: Instagram Graph API (conta Business/Creator
    vinculada a página do Facebook + app Meta for Developers com
    `instagram_basic` + token long-lived com refresh automático ~60 dias).
  - **Config no admin**: global do Payload `SocialFeedSettings` — YouTube API
    key, channel ID, IG access token, IG user ID, máx. itens, toggle por
    plataforma, "pausar feed" (kill switch — não é curadoria).
  - **Fail-closed**: API falhou/token expirou → mantém último snapshot em
    cache; página nunca quebra. IG só liga após setup da Meta (review leva dias).
  - **Nunca** script de embed pesado do Instagram no carregamento (derruba
    LCP no mobile).

## 5. Pendências (roteamento)

| Pendência                                                                                                                                                                                                                                                                                                                                                                                                                           | Roteamento                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Número de WhatsApp oficial da campanha (placeholder `5571999999999`)                                                                                                                                                                                                                                                                                                                                                                | Assessoria                      |
| CNPJ da campanha (rodapé)                                                                                                                                                                                                                                                                                                                                                                                                           | Advogado eleitoral              |
| Depoimentos reais (3, nome + cidade + foto)                                                                                                                                                                                                                                                                                                                                                                                         | Assessoria                      |
| Foto hero 4:5 + foto de apoio (multidão/caravana)                                                                                                                                                                                                                                                                                                                                                                                   | Produção                        |
| Contador de apoiadores? (se exibir, fonte = banco real, nunca inventar)                                                                                                                                                                                                                                                                                                                                                             | Coordenação                     |
| Confirmar "50 dias" na data de publicação (contagem com data fixa)                                                                                                                                                                                                                                                                                                                                                                  | Assessoria                      |
| **Doutorado sanduíche em Durham** — não consta nas fontes atuais (doutorado = UFRJ, 2009); se confirmado, entra na Formação                                                                                                                                                                                                                                                                                                         | Verificação com assessoria      |
| **"Professor da UFBA"** — fonte atual diz "pesquisador do ISC-UFBA"                                                                                                                                                                                                                                                                                                                                                                 | Verificação com assessoria      |
| **Mix mandato/campanha no board**: automático expõe tudo que a conta postar; se @depjorgesolla postar conteúdo de mandato no período eleitoral, decide-se: aceitar mix, filtrar por tag/hashtag, ou usar conta de campanha                                                                                                                                                                                                          | Assessoria                      |
| Variante de hero (A ativa; B/C documentadas) + plano de A/B                                                                                                                                                                                                                                                                                                                                                                         | Coordenação + este plano        |
| **"Teto de gastos" vs "arcabouço fiscal"**: o teto (EC 95/2017, governo Temer) foi substituído pelo Novo Arcabouço Fiscal (LC 200/2023). O copy aplicado usa "teto de gastos da direita" (decisão do cliente, 15/08 — culpa o campo político de Temer, amarrando à eleição atual, em vez do inimigo específico antigo); a imprecisão jurídica do instrumento segue registrada para checagem da assessoria/advogado antes do go-live | Assessoria + advogado eleitoral |
| **Status processual da pauta 6×1** (card "Jornada que adoece"): o copy afirma que o fim da 6×1 foi aprovado na Câmara (derrotando a direita) e está no Senado, com risco de modificação/adiamento de 10 anos. Confirmar com a assessoria o estágio exato (nº da proposta, o que foi votado, prazo proposto pela direita) antes do go-live — sem fonte, não publica                                                                  | Assessoria                      |

## 6. Regras inegociáveis (vale para qualquer issue derivada)

- Sem fonte, não publica (número, obra, citação, depoimento).
- Um CTA por página; nunca dividir atenção acima da dobra.
- LGPD: consentimento explícito, fail-closed; nunca CPF/endereço no 1º passo.
- Doação só via QueroApoiar; o app nunca processa pagamento.
- Nada de fake news, ataques pessoais ou desinformação (combate com fatos).
- Nunca inventar foto, depoimento, apoiador, selo ou cobertura (NEEDS ASSET).
- Período eleitoral: mecanismo `hidden`/`isPostVisible` para puxar conteúdo
  quando exigido; site de mandato e de campanha não se misturam sem orientação.
- Convenções do Teqo: identificadores em inglês, transações, migrações
  commitadas, revalidação de cache, admin em pt.

## 7. v2 — ideias registradas (não priorizadas)

### 7.1 Compartilhamento por seção (ideia do cliente, 15/08/2026)

Cada subseção vira algo compartilhável pelo visitante nas redes sociais:

- **WhatsApp com mensagem pré-configurada por seção** — ex.: "Olha a proposta
  do Jorge Solla para o fim da escala 6×1: [link]". O WhatsApp é o canal de
  compartilhamento nº 1 no Brasil — mesma lógica do CTA primário.
- **Imagem OG por seção**: o preview do link no WhatsApp é o que vende o
  clique — gerar card/imagem por seção (proposta, trajetória, depoimento).
- **Botões de compartilhar discretos por card**, nunca competindo com o CTA
  primário da página.
- **UTM por seção** para medir qual conteúdo mais circula — vira insumo de
  conteúdo para a reta final (fechar o loop com a assessoria).
- Seções candidatas: cards de proposta (maior valor prático/currency),
  trajetória (prova), depoimentos (voz de terceiros), board IG/YT.

### 7.2 Páginas próprias de bandeira (SEO/AEO)

Cada card de bandeira vira página própria ("fim da escala 6x1", "recompra de
Mataripe", "saúde na Bahia") — são buscas reais; structured data de entidade
(Person, PoliticalParty, Office).

## 8. Próximos passos

1. Revisão humana do wireframe (seções, textos, variantes de hero).
2. Resolver pendências de conteúdo (assessoria/advogado) — bloqueiam go-live.
3. Quando a equipe estiver pronta: **gerar planos de issue a partir deste
   documento** (cada seção/d decisão vira um `docs/plans/` + Issue).
4. Testes A/B de uma variável por vez (título, CTA, foto, formulário) com
   7–14 dias de medição.

## Anexo — Mapa de fotos por subseção (levantamento 15/08/2026)

> Fotos no jorgesolla.com.br são ativos da campanha (uso seguro). Fotos de
> terceiros (Agência Brasil, Bnews, A TARDE) precisam de autorização. Banco
> local: `/home/fsolla/Documentos/Solla/MATERIAL SOLLA/FOTOS/SELEÇÃO/` (52 fotos JOA\*.jpg).

| Subseção                   | Tema               | Fotos candidatas (link)                                                               | Nota                                 |
| -------------------------- | ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------ |
| Hero (retrato)             | Retrato 4:5        | `jorgesolla.com.br/wp-content/uploads/2026/05/SOLLA-CARD.jpg` (via artigo Clube 2004) | Retrato vertical, ideal p/ hero      |
| Hero/aliança (alternativa) | Lula+Jerônimo+time | `…/2026/08/PT-CONVENCAO.jpg` (artigo convenção 02/08)                                 | Multidão/time                        |
| Saúde (card + proposta)    | Hospital           | `…/2026/07/IMG_1672.jpeg` (artigo Hospital Litoral Norte)                             | Inauguração                          |
| Saúde (trabalhadores)      | Piso enfermagem    | `…/2026/05/PISO-ENFER-II-foto-Marcelo-Camargo-Agencia-Brasil.jpg`                     | ⚠️ Foto Agência Brasil — autorização |
| Jornada 6×1                | Multidão subúrbio  | `…/2026/06/PGP-SUBURBABANA.jpeg` (artigo PGP Periperi)                                | Multidão (não específica 6×1)        |
| Jornada 6×1 (externo)      | Coletiva           | bnews.com.br (foto Henrique Brinco) e atarde.com.br                                   | ⚠️ Terceiros — referência            |
| Mataripe                   | —                  | Nenhuma foto do Solla nos artigos (só fundo genérico)                                 | Usar banco local ou produzir         |
| Educação                   | FAMED UFBA         | `…/2026/05/IMG_0638.jpeg` (artigo visita CFFC/FAMED)                                  | Educação + saúde                     |
| Renda                      | Pacote R$ 2 bi     | `…/2026/06/GOVBA-PACOTE-2-BI-1024x683.jpeg`                                           | Verificar presença do Solla          |
| Democracia                 | 2 de Julho         | `…/2026/07/2-de-julho.jpg`                                                            | Data cívica                          |
| Quem é (timeline)          | Históricas         | Não encontradas em artigos atuais                                                     | Banco local / arquivo do mandato     |
| Prova de trabalho          | Plenária Câmara    | `…/2026/08/PLENARIA-SOLLA.jpeg` e `…/2026/08/PLENARIA.jpg` (artigo 11/08)             | Solla em plenária                    |
| CTA final (multidão)       | Caravana           | `…/2026/07/PHOTO-2026-07-31-13-37-26.jpg` e `…-1.jpg` (artigo Chapada)                | 2 fotos                              |
| CTA final (interior)       | Ubatã              | `…/2026/06/2e00ab79-13ba-4b39-86e4-52d894c6ddd2.jpeg` (artigo mercado Ubatã)          | Inauguração                          |
| Board IG/YT                | —                  | Vem da API (sem foto fixa)                                                            | —                                    |
