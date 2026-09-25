# Post-mortem: logo do header da Central de Conteúdos cortado — janela de recorte sem a razão da tinta

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-25                                                                                                                      |
| Severidade          | baixa (branding no header público da Central; sem perda de dados)                                                               |
| Ambiente            | prod (sintoma, repro read-only) + dev/worktree (diagnóstico e fix)                                                              |
| Issue(s)            | sem Issue — fluxo `/bug-fix` do worktree `fix/12` (o post-mortem é o registro); o S36 que introduziu o bug fechou a Issue #1301 |
| PR do fix           | pendente (este PR)                                                                                                              |
| Detectado por       | humano (relato que abriu a sessão `/bug-fix` do worktree `fix/12`)                                                              |

## Timeline

| Momento            | Data/hora             | Evento                                                                                                                                                                                                                      |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-09-24 02:20 BRT  | Commit `772a5cf0` "fix(S36): logo do header da Central no tamanho da marca (Closes #1301)" troca o `Image` direto `h-7 sm:h-9` pela janela `overflow-hidden` de recorte, portando os números do artefato de design          |
| Detecção           | 2026-09-25 ~00:07 BRT | Reprodução read-only em produção nos dois breakpoints (1280px: janela 188×50 e tinta real 187,4×67,6 → 18px cortados; 390px: janela 142×39 e tinta 141,7×51,1 → 12,2px cortados); hora exata do relato original não apurada |
| Correção mergeada  | pendente (este PR)    | —                                                                                                                                                                                                                           |
| Deploy             | pendente              | merge em `main` dispara deploy; produção só com approve humano no environment `production` (não feito ainda)                                                                                                                |
| Verificado em prod | pendente              | aguardando confirmação do humano (nunca declarar corrigido antes)                                                                                                                                                           |

## O bug

No header público da Central de Conteúdos (`/conteudos`), a marca aparecia "muito grande e cortada": a base de "SOLLA" sumia. Afetava as três superfícies do header — catálogo `/conteudos`, página da peça `/conteudos/<slug>` e não-encontrado — em desktop e mobile.

A reprodução read-only em produção (2026-09-25 ~00:07 BRT) mediu os dois breakpoints: a 1280px a janela de recorte era 188×50 e a tinta real 187,4×67,6 (18px cortados); a 390px a janela era 142×39 e a tinta 141,7×51,1 (12,2px cortados). Sem perda de dados; branding/marca no header da Central na reta final.

## Causa-raiz

5 whys:

1. A base de "SOLLA" sumia porque a janela de 188×50 cobria uma tinta de 67,6px de altura.
2. A janela foi dimensionada "no olho" como o lockup visível, sem derivar da caixa da tinta medida.
3. O design hand-authored os crops sem passo de `trim`/alpha bbox do ativo.
4. O design foi lido como spec, e o e2e `frontendConteudos` só checava texto/heading — nenhum teste pinava geometria.
5. `scripts/lib/campaignKitAssets.mjs` é só leitor de data URI (zero validação de geometria) e o risco do S36 ficou em prosa.

O PNG oficial `public/campaign-kit/jorge-solla-negativo.png` tem canvas 1037×595 com tinta visível (alpha bbox) 790×285 nos offsets esquerda 123 / topo 162 (medido com `sharp(...).trim()`); a razão da tinta é 790/285 ≈ 2,77. A janela do S36 tinha razão 188/50 ≈ 3,76 (mobile 142/39 ≈ 3,64) — incompatível. Escalando a imagem para 246px de largura (mobile 186px), a tinta ficava 187,4×67,6 (mobile 141,7×51,1), mais alta que a janela, e o `overflow-hidden` decapitava a base.

Origem: `src/components/conteudos/ContentPiecePageHeader.tsx:21` (janela) + `:28` (imagem/offsets), no estado pré-fix. O artefato de design aprovado `docs/plans/central-conteudos-header-logo-ui-design.html:52-73` já trazia os números errados (`.trimmed-lockup` 188×50 / img 246px / -29/-38; mobile 142×39 / 186px / -22/-29) e a implementação os portou fielmente. O peso-alvo declarado no S36 era a referência `/jingles` (`CampaignPageHeader.tsx:26`, tinta 51,6px desktop / 46,0px mobile) — a janela nunca teve a proporção da tinta.

## Correção

Em `src/components/conteudos/ContentPiecePageHeader.tsx`, a janela passa a ser a caixa da tinta no peso da referência `/jingles`: mobile `h-[46px] w-[128px]` (img 167px, offsets -19,8/-26,1) e desktop `sm:h-[52px] sm:w-[144px]` (img 189px, offsets -22,4/-29,5). O comentário do componente foi reescrito com a invariante (a janela tem a mesma razão da tinta; a moldura não) e a receita de recálculo (`sharp(asset).trim()` → caixa + trimOffset; imgWidth = inkHeight × 1037/285; offsets proporcionais).

Nenhum outro consumidor foi tocado; `CampaignPageHeader` (`/jingles`) intocado; sem migration/access/Consent.

## Verificação

- Teste de regressão: `tests/e2e/frontendConteudos.e2e.spec.ts` — "keeps the whole brand ink inside the header crop, both breakpoints (S36)" — mede o alpha bbox real do PNG com sharp, calcula a caixa da tinta renderizada por bounding boxes e asserta que ela cabe na janela de recorte em 1280 e 390. Provado **RED** sem o fix (falha `ink bottom clipped @1280px`, esperado ≤57,5, recebido 75,04) e **GREEN** com o fix.
- Suíte: `pnpm test:e2e --no-deps --project=frontendConteudos` 12/12; `--project=frontendJingles` 5/5; `pnpm gate:fast` verde (lint + typecheck + unit 4685 em 423 arquivos); `pnpm format:check`, `pnpm knip` e `pnpm check:cycles` verdes.
- CI: pendente (PR ainda não aberto).
- Prod: pendente de approve humano e confirmação (nunca declarar corrigido antes).

## Prevenção

| Estratégia                                                                                                             | Custo  | Estado                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Teste de regressão e2e que mede o alpha bbox real do PNG e a tinta renderizada contra a janela nos dois breakpoints    | barata | implementada agora (este PR)                                                                          |
| Nota em `public/campaign-kit/README.md` §"Lockups do nome": derivar a janela da caixa da tinta medida, nunca do canvas | barata | implementada agora (este PR)                                                                          |
| Comentário do dono com a invariante e a receita de recálculo (`sharp trim`)                                            | barata | implementada agora (este PR)                                                                          |
| Asset trimmed versionado no kit + pipeline de preparo                                                                  | cara   | documentada — não implementada neste fluxo (muda o ativo dono e todos os consumidores; Issue própria) |
| Passo de medição obrigatório no fluxo de design (`plan-issue` ui-design)                                               | cara   | documentada — não implementada neste fluxo                                                            |
| Harness de CI que acorde specs ao mudar `public/**` + baseline visual do header                                        | cara   | documentada — não implementada neste fluxo                                                            |

**Estratégia implementada:** as três baratas acima — o teste e2e que mede o ativo real (não a intenção), a nota no README do kit e o comentário do dono com a receita de recálculo.

**Estratégia documentada (cara):** as três caras acima — asset trimmed versionado com pipeline de preparo (candidata a Issue própria, pois muda o ativo dono e todos os consumidores), medição obrigatória no fluxo de design e harness de CI com baseline visual do header.

## Lições

- Design hand-authored como spec sem medição do ativo transfere erro geométrico para o port fiel: o S36 implementou os números exatos do artefato e o artefato estava errado.
- e2e de página que só checa texto/heading não guarda layout: nenhum teste media geometria, então a janela errada passou verde.
- "Fiel ao design" é fidelidade à intenção (peso da referência `/jingles`), não aos números do artefato — quando o número não fecha com a medição do ativo, a medição vence.
