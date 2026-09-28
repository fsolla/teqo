# Programa — Redesign das superfícies públicas (2026-09-28)

> **Natureza deste documento:** plano **de programa** (não é plano de issue).
> Registra o diagnóstico, a matriz de cobertura de rotas, as fatias de entrega,
> a reconciliação factual e os riscos. **A partir dele** cada fatia gera seu
> `docs/plans/<slug>.md` + Issue quando o design da fatia estiver aprovado.
>
> **Status:** auditoria concluída (2026-09-28); design da fatia 1 em aprovação
> (`docs/plans/site-publico-campanha-home-ui-design.html`).
> **Vertentes:** campanha (`campaign-site`) e editorial (`editorial`), com a
> separação obrigatória entre mandato e campanha.

## 1. Objetivo

Reconstruir a experiência pública de `jorgesolla1313.com.br` como uma
experiência **editorial/documental moderna**: tipografia forte, fotografia
autêntica, composição variada (nunca grade repetitiva de cards), ritmo de
leitura e uma interação-assinatura (capítulos de texto com fotos que mudam,
sticky no desktop e inline no mobile). Preservar a identidade de campanha
(lockup, vermelho, amarelo como sinal) e os contratos públicos existentes.

Regras estruturantes: PT-BR em todo conteúdo visível; um CTA primário por
página; conversão por WhatsApp; doação **só** link para `apoiar.me/jorgesolla`;
sem fonte, não publica; consentimento fail-closed; `hidden`/`isPostVisible`
intocados; nada de superfície pública nova que viole o período eleitoral.

## 2. Matriz de cobertura

Legenda de ação: **R** = redesenhar; **P** = preservar (só contrato/estilo
mínimo); **E** = endpoint não visual (preserve-only); **G** = adição gateada.

| #   | Rota / feature                            | Dono atual (código)                                        | Fatia | Ação | Critério de aceite                                                                                                                                                                                |
| --- | ----------------------------------------- | ---------------------------------------------------------- | ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                                       | `(frontend)/(home)/page.tsx` + `layout.tsx`                | S1    | R    | Composição completa aprovada no artefato; seções identidade→princípios→trabalho→trajetória→conteúdo→participação; CTA primário único; vazio/erro/recusa desenhados; assinatura com reduced-motion |
| 2   | Shell de campanha (header/footer/nav)     | `CampaignPageHeader`, `CampaignLogoLink`, `CampaignFooter` | S1    | R    | Um só shell para home/conteúdos/jingles/fotos; alvos ≥44px; identificação eleitoral intacta; "Fotos" condicional preservada                                                                       |
| 3   | `/conteudos`                              | `conteudos/(catalog)/page.tsx`                             | S2    | R    | Lista/filtros/estados redesenhados; canonical `/conteudos`; `noindex` com 0 peças; skeletons preservados                                                                                          |
| 4   | `/conteudos/[slug]`                       | `conteudos/[slug]/page.tsx`                                | S2    | R    | Detalhe + player + share redesenhados; 404 uniforme; OG `video.other`/`article`                                                                                                                   |
| 5   | `/conteudos/[slug]/midia`                 | `conteudos/[slug]/midia/route.ts`                          | S2    | E    | Range/streaming, `?download=1` `jorge-solla-1313-<slug>.<ext>`, evento anônimo — intocados                                                                                                        |
| 6   | `/conteudos/[slug]/frame`                 | `conteudos/[slug]/frame/route.ts`                          | S2    | E    | Geração/espera do still dentro do orçamento — intocada                                                                                                                                            |
| 7   | `/corte/[id]`                             | `corte/[id]/page.tsx` + `corte/layout.tsx`                 | S2    | R    | `noindex` sempre; crédito de origem; 404 uniforme; share kit preservado                                                                                                                           |
| 8   | `/jingles`                                | `jingles/page.tsx`                                         | S2    | R    | Player/reprodução/download `jorge-solla-1313-<slug>.mp3`; vazio honesto; áudio nunca autoplay                                                                                                     |
| 9   | `/midia` (referida no brief)              | = itens 5/6 (endpoints de mídia)                           | S2    | E    | Registrada como endpoint; não há página `/midia` no app                                                                                                                                           |
| 10  | `/artigos`                                | `artigos/page.tsx`                                         | S3    | R    | Landing editorial restilizada; imagem do destaque corrigida; sem chrome de campanha                                                                                                               |
| 11  | `/[type]`                                 | `[type]/page.tsx` (`[type]/layout.tsx`)                    | S3    | R    | Listagem por tipo restilizada; canonical; `generateStaticParams`/`dynamicParams` preservados                                                                                                      |
| 12  | `/[type]/[category]`                      | `[type]/[category]/page.tsx`                               | S3    | R    | Listagem de categoria restilizada; separação editorial mantida                                                                                                                                    |
| 13  | `/[type]/[category]/[slug]`               | `[type]/[category]/[slug]/page.tsx`                        | S3    | R    | Artigo: JSON-LD `Article`, OG, redirect canônico, ISR `posts` — preservados                                                                                                                       |
| 14  | ShareLink `/[type]` (direct/announcement) | `[type]/page.tsx` branch + `components/shareLink/*`        | S3    | R    | Redirecionamento instantâneo e página de anúncio restilizadas; poll 30s e OG preservados                                                                                                          |
| 15  | `/api/share-link/[slug]/live`             | `api/share-link/[slug]/live/route.ts`                      | S3    | E    | `{target}` nunca 5xx, `no-store` — intocado                                                                                                                                                       |
| 16  | `/[type]/evento.ics`                      | `[type]/evento.ics/route.ts`                               | S3    | P    | Saída `.ics`, nome do arquivo e `Cache-Control` intocados                                                                                                                                         |
| 17  | `/privacidade`                            | `privacidade/page.tsx`                                     | S4    | R    | Texto legal intacto; restilo editorial; 404 se `!published`                                                                                                                                       |
| 18  | `/mandato-no-whatsapp`                    | `mandato-no-whatsapp/page.tsx`                             | S4    | R    | Fluxo/form preservados; Consent `whatsapp-inscricao` fail-closed; ≥16px inputs                                                                                                                    |
| 19  | `/abaixo-assinado/[id]`                   | `abaixo-assinado/[id]/page.tsx`                            | S4    | R    | Assinatura transacional/consent intactos; **bug 500 em id inexistente corrigido (404)**; JSON-LD/pixel preservados                                                                                |
| 20  | Newsletter da home                        | `CampaignNewsletterSection` + `submitCampaignNewsletter`   | S1/S4 | R    | Consent `campanha-novidades` fail-closed; pixel Lead preservado; estado de recusa desenhado                                                                                                       |
| 21  | `/cards` (estúdio)                        | `(home)/cards/page.tsx` + `components/cards/*`             | S5    | R    | 6 modelos reais; `?model=` válido; `#cards` da home; nomes de arquivo e telemetria anônima preservados                                                                                            |
| 22  | Wizard kit completo (extensão)            | `CardsStudio`/`CardComposer` (dono)                        | S5    | R    | Passos nome→foto→dobradinha→kit; nunca gera arte incompleta; foto nunca sai do browser; back/forward na sessão; sem persistência silenciosa                                                       |
| 23  | `/fotos` (C233)                           | `fotos/page.tsx` + `components/fotos/*`                    | S6    | G    | Só `approved`; kill switch `photoAlbum.published`; canal de remoção; vazio honesto; **abertura exige decisão registrada**                                                                         |
| 24  | `/fotos/encontre` (C234)                  | `fotos/encontre/page.tsx` + `api/fotos/selfie`             | S7    | G    | `selfieSearchEnabled` fail-closed; Consent por chave; sem score/nome; on-device; **dark até decisão**                                                                                             |
| 25  | `/api/revalidate`                         | `api/revalidate/route.ts`                                  | —     | P    | Allowlist de tags intocada                                                                                                                                                                        |
| 26  | `/api/content-events`                     | `api/content-events/route.ts`                              | S2    | P    | Beacon anônimo: schema, rate-limit, catálogos — intocados                                                                                                                                         |
| 27  | `/api/social-feed/sync`                   | `api/social-feed/sync/route.ts`                            | —     | P    | Auth admin + same-origin — intocado                                                                                                                                                               |
| 28  | Metadados raiz/robots/OG                  | `(frontend)/layout.tsx`, `robots.ts`, `lib/seo`            | S1    | P    | Fallbacks e noindex de staging preservados                                                                                                                                                        |
| 29  | `hidden`/`isPostVisible`                  | `src/utilities/posts.ts`                                   | S3    | P    | Falha fechada; remoção sem deploy — intocados                                                                                                                                                     |

Nenhuma rota da lista do programa fica sem dono. `/midia` e `/frame` são
endpoints de mídia da Central (itens 5/6), não páginas.

## 3. Fatias

| Fatia  | Escopo                                                                        | Depende                         | Appetite | Design                                      |
| ------ | ----------------------------------------------------------------------------- | ------------------------------- | -------- | ------------------------------------------- |
| **S0** | Auditoria, matriz, plano, 1º pacote de design                                 | —                               | —        | campanha home+shell                         |
| **S1** | Shell de campanha + home (itens 1–2, 20)                                      | S0                              | M        | `site-publico-campanha-home-ui-design.html` |
| **S2** | Central de Conteúdos, cortes, mídia embutida, jingles (3–9, 26)               | S1 (shell)                      | M        | artefato próprio por superfície             |
| **S3** | Editorial: artigos, listas, artigo, share-links, `.ics` (10–16, 29)           | S0                              | M        | artefato próprio                            |
| **S4** | Participação: WhatsApp, abaixo-assinado, privacidade, polish de forms (17–20) | S1                              | S/M      | artefato próprio                            |
| **S5** | Wizard do kit de apoio (21–22)                                                | S1                              | M        | artefato próprio (estende `/cards`)         |
| **S6** | Álbum público C233 (23) — gateado                                             | S3 (editorial) + decisão        | S        | artefato C233 aprovado + relatório          |
| **S7** | Selfie C234 (24) — gateado                                                    | S6 + C231/C232 + Consent + DPIA | —        | artefato C234 aprovado                      |

O núcleo (S1–S5) não depende de S6/S7; bloqueio de uma adição gateada não para
o resto. Cada fatia exige: reconciliação factual dos claims que publica,
seleção de mídia com status de publicação, estados críticos, testes afetados,
changelog e evidência no PR.

## 4. Reconciliação factual (holds)

Corpus de referência: `docs/research/briefing-geral-militancia/` (legível) e
`data/briefing-geral-militancia/` (ledgers, untracked). Regra: sem fonte
(ledger + `sourceUrl` + `sourceDate`), não publica.

| Claim atual na home                             | Evidência no corpus                                                                                                                                              | Decisão                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Criou o SAMU 192"                              | Resgate Médico em Vitória da Conquista é **apontado como origem da ideia**; em 2003, como secretário de Atenção à Saúde, **participou da criação e implantação** | **HOLD** — publicar "participou da criação do SAMU 192" (ou formulação equivalente aprovada pela voz)              |
| "Criou o Brasil Sorridente"                     | "Assinou as diretrizes da Política Nacional de Saúde Bucal, o Brasil Sorridente" (2003–2005)                                                                     | **HOLD** — trocar por "assinou as diretrizes do Brasil Sorridente" / "participou do lançamento"                    |
| "Mais votado do PT-BA em 2022"                  | Ledger: em 2022 foi **14º mais votado do estado** (128.968 votos; 78,9% do interior); em 2018, **5º**                                                            | **HOLD** — substituir por fato lastreado (ex.: votação de 2022 por território)                                     |
| "DIAP entre os 40 melhores da Câmara"           | Não consta no corpus                                                                                                                                             | **HOLD** — só publicar com fonte verificada                                                                        |
| "3.333 proposições" / "1.031 discursos"         | Fonte do plano: API Dados Abertos/SitaqWeb (13/08/2026), fora do corpus                                                                                          | **Re-verificar** na data de publicação ou substituir por números do corpus (SESAB, SAMU, enfermagem, Mais Médicos) |
| "4 de outubro", "1313", identificação eleitoral | Plano + kit                                                                                                                                                      | Manter; reconferir na publicação                                                                                   |

A redação final da fatia passa por `solla-comunicacao` antes de entrar no
artefato; a atribuição exata do corpus é preservada (autoria ≠ coautoria ≠
relatoria ≠ voto ≠ articulação ≠ gestão).

## 5. Riscos e bloqueios registrados

1. **Timing eleitoral (04/10/2026).** Hoje 28/09/2026. C233/C234 permanecem
   fechadas por padrão; abrir qualquer superfície pública nova exige decisão
   registrada (humano + coordenação). O deploy de produção é aprovação humana.
2. **`/abaixo-assinado/1` responde 500 em produção** (id inexistente deveria
   404). Bug público aberto; entra na S4 com teste de regressão (ou hotfix antes).
3. **`/artigos` com imagem de destaque quebrada** em produção (ícone de erro).
4. **Home atual:** grade de 6 cards idênticos ("Nossa caminhada") e fotos de
   cidade genérica no card de Mataripe — alvos do redesign e da curadoria.
5. **Corpus de fotos públicas:** `public/*.avif` (hero/colagem) e
   `public/campaign-kit/` são os ativos publicados; `archivePhoto` não tem foto
   aprovada em produção (álbum vazio). Fotos de terceiros (Agência Brasil,
   Bnews, A TARDE) seguem exigindo autorização — não publicar sem ela.

## 6. Contratos públicos preservados (qualquer fatia)

URLs/deep links, proxy de mídia same-origin e nomes de download, tag de cache
`posts`/`archivePhotos`/etc. e allowlist do revalidate, chaves de consent,
`robots`/noindex, JSON-LD, `.ics` e nome de arquivo, comportamento de formulário,
telemetria anônima de download, `hidden`/`isPostVisible`, separação
mandato/editorial/campanha. Mudança nesses contratos só na fatia que
explicitamente a possui e com aprovação registrada.

## 7. Publicação

Commits podem conter: copy pública aprovada, proveniência mínima (fonte pública

- data), planos/decisões de design, mídia aprovada para publicação. Fora do
  repo (untracked): ledgers, dumps de pesquisa, Q&A interno, inventários de
  ativos privados, PII e segredos. O design aprovado viaja com o plano; o
  artefato é a fonte de verdade do port.
