# Post-mortem: tiles dos cards personalizados somem no WebKit — `aspect-ratio` em flex item (#265243)

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Data do post-mortem | 2026-09-24                                                                                                         |
| Severidade          | alta (funil público de conversão; nenhum dado perdido)                                                             |
| Ambiente            | prod                                                                                                               |
| Issue(s)            | sem Issue — relato do humano na sessão do worktree `fix/9` (o bug-fix não exige Issue; o post-mortem é o registro) |
| PR do fix           | #1321                                                                                                                              |
| Detectado por       | humano                                                                                                             |

## Timeline

| Momento            | Data/hora                    | Evento                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-09-12 (S13, `681f3bb5`) | O construto do tile nasce com `aspect-ratio` inline num flex item e segue inalterado por S15/S30/S31/S34                                                                                                                                                                                                                                                                                                               |
| Detecção           | 2026-09-24 (sessão `fix/9`)  | Humano relata, em produção, que os seis tiles de modelos do estúdio de cards não aparecem: "A sessão fica menor de altura, mostrando só os títulos dos modelos." Navegador do relator: Orion/Safari (WebKit); o humano não sabia dizer se as imagens falhavam ou se era o layout                                                                                                                                       |
| Diagnóstico        | 2026-09-24                   | Em prod (HEAD `38e67426`, deploy run 35968308781, workflow_dispatch, completed 2026-09-24T13:07:43Z): os 6 URLs de assets e todas as variantes `_next/image` retornam 200 (inclusive 120 requisições paralelas, todas 200); em Chromium a 360–1920 os 6 tiles carregam sem overflow horizontal → assets/serving saudáveis, o problema é de layout/motor. Reprodução local com o WPE WebKit `webkit-2248` fecha a causa |
| Correção mergeada  | a definir (este PR)          | —                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Deploy             | a definir                    | deploy começa no merge; produção só após approve humano no environment `production`                                                                                                                                                                                                                                                                                                                                    |
| Verificado em prod | pendente (aguarda o humano)  | confirmação pendente, inclusive no Orion                                                                                                                                                                                                                                                                                                                                                                               |

## O bug

Na home de produção (`jorgesolla1313.com.br`), os seis tiles de modelos do estúdio de cards personalizados — seção `#cards`, "Mostre que você está com Solla" — não apareciam no Orion/Safari (WebKit). O relato do humano: "A sessão fica menor de altura, mostrando só os títulos dos modelos." O humano não sabia se as imagens falhavam ou se o layout quebrava.

Os checks read-only em produção descartaram imagem/serving: os 6 URLs de assets e todas as variantes de largura do `_next/image` retornaram 200 (incluindo 120 requisições paralelas, todas 200), e em Chromium, de 360 a 1920, os 6 tiles carregavam sem overflow horizontal. O defeito era de layout/motor, restrito ao WebKit.

## Causa-raiz

1. No WebKit, os seis tiles sumiam; sobravam os rótulos dos modelos e a seção encolhia.
2. A caixa do tile em `src/components/cards/CardModelTile.tsx` derivava a altura de um `style={{ aspectRatio: '<w>/<h>' }}` inline, sendo filha de um `display:flex` (o `button` com `flex ... flex-col`) com `overflow: hidden`.
3. Esse é exatamente o construto do bug **WebKit #265243**: `aspect-ratio` num flex item perde a altura no relayout (reportado em 2023-11 para o Safari 17; corrigido só no WebKit main em 2026-05-13, commit 313170@main) — e o WebKit embarcado no navegador do relator ainda contém o bug.
4. Sem a altura da caixa, o único filho em fluxo que restava era o rótulo do modelo — por isso a seção encolhia aos títulos.
5. O construto entrou na S13 (`681f3bb5`, 2026-09-12) e passou incólume por S15/S30/S31/S34: Chromium/Firefox são imunes, e nenhum projeto Playwright do CI roda WebKit (todos são Desktop Chrome/chromium) — o defeito era invisível para a suíte pelo tempo em que existiu.

**Evidência de reprodução (local).** O bundle WPE WebKit `webkit-2248` (build de 2026-01-14, anterior ao fix upstream) falha o caso WPT WebKit de #265243 (200×500 stale contra 200×200 do Chromium) e, num harness direto com o mesmo construto do tile como flex item sob um flex row cuja altura depende dele, fica **200×667 stale** após mudança de largura do container 500→200, enquanto o Chromium dá 200×267. Nota honesta de não-reprodução: a estrutura real truncada (button column flex) **não** falhou no WPE; o Apple WebKit do relator (Orion) falha — a hipótese se sustenta no bug upstream e nas assinaturas medidas.

## Correção

Em `src/components/cards/CardModelTile.tsx`, a caixa do tile deixa de usar `aspect-ratio`: a altura passa a vir de um espaçador em fluxo

`<span aria-hidden data-card-tile-ratio={h/w} class="block w-full" style={{ paddingBottom: '<ratio*100>%' }}/>`

— o `padding` percentual resolve contra a largura do tile, é à prova de motor e mantém a proporção exata de cada arte-mestre. O `Image` fill absoluto, o canvas, os badges e o layout do rótulo ficam inalterados. Um comentário no componente registra o bug do WebKit para quem mexer ali depois. Sem migration, sem Consent/access, sem contrato de URL/shape público.

## Verificação

- Teste de regressão: `tests/unit/cardModelTile.unit.spec.tsx` (6 modelos: o espaçador existe, ratio/padding batem com o modelo, e não há `aspect-ratio` no markup) — verificado **RED** sem o fix (6/6 falham no arquivo pré-fix, restaurado por hash) e **GREEN** com ele.
- Guard de convenção: `tests/unit/codebaseConventions.unit.spec.ts` — sweep "card studio geometry comes from the ratio spacer", proibindo `aspectRatio:` inline e utilitários `aspect-*` em `src/components/cards/*.tsx`.
- e2e: `tests/e2e/frontend.e2e.spec.ts` (bloco S14) confere, para cada tile visível, altura da caixa ≈ largura × proporção declarada (±4px) após relayout forçado (`setViewportSize(1200)`); `--project=frontend -g "Cards personalizados"` → **21 passed (1.0m)**.
- Suíte: `pnpm gate:fast` verde (lint, `tsc --noEmit`, unit 411 arquivos/4552 testes à época; o guard de convenção entrou depois).
- Engine real: WPE antigo com o construto pré-fix → 200×667 (bug); com o espaçador do fix → 200×267; Chromium dá 200×267 nos dois.
- CI: a confirmar no PR.
- Prod: pendente — o deploy começa no merge; produção só após approve humano no environment `production`; aguarda confirmação do humano (inclusive no Orion).

## Prevenção

| Estratégia                                                                                                                                                                                                                                                          | Custo  | Estado                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| Unit do espaçador de proporção + sweep de convenção nos cards + asserção e2e de geometria após relayout forçado                                                                                                                                                     | barata | implementada agora (este PR)               |
| Projeto e2e WebKit dedicado no CI (`playwright install --with-deps webkit` no runner; um `frontendWebkit.e2e.spec.ts` com poucos specs de geometria/relayout ligados ao risk mapping do `scripts/ci-scope.mjs` para rodar em PRs que tocam `src/components/**`)     | cara   | documentada — não implementada neste fluxo |
| Migrar os demais sítios da mesma classe para um primitivo compartilhado de ratio box: `src/components/CampaignStorySection.tsx` (`aspect-[9/16] ... shrink-0 ... overflow-hidden`, flex item, linha ~52) e `src/components/CampaignContentCard.tsx` (linhas ~43-45) | cara   | documentada — não implementada neste fluxo |
| Guarda baseada em AST (TS compiler API) para `aspect-*` em flex item — o sweep textual não enxerga a forma original (flex child sem `shrink-0`/`flex-1`)                                                                                                            | cara   | documentada — não implementada neste fluxo |

**Estratégia implementada:** três guardas baratos que travam o construto frágil e a geometria: o unit por modelo, o sweep textual que bane `aspect-ratio`/`aspect-*` nos cards e a asserção e2e de altura ≈ largura × proporção depois de um relayout forçado — a operação que o WebKit errava.

**Estratégia documentada (cara):** cobertura de engine de verdade no CI (projeto WebKit) e a migração dos outros sites same-class para um primitivo compartilhado de ratio box; a guarda textual não alcança a forma original (flex item sem `shrink-0`/`flex-1`), o que pediria uma análise AST — candidatas a Issue futura.

## Lições

- **O CI é 100% Chromium.** Nenhum projeto Playwright roda WebKit; um construto quebrado só no WebKit viveu da S13 (2026-09-12) até aqui sem sinal nenhum na suíte.
- **"Passa em Chrome" não é prova para WebKit.** Os checks de assets e a varredura em Chromium a 360–1920 estavam todos verdes enquanto a produção estava quebrada para o relator.
- **Bug upstream pode demorar anos — e o browser pode embarcar WebKit próprio.** O #265243 foi reportado em 2023-11 e só foi corrigido no WebKit main em 2026-05-13; o Orion embarca o WebKit dele, então o produtor do construto precisa evitar a forma frágil, não esperar o fix.
- **Harness de engine local prova causa-raiz e fix quando o browser do relator não está disponível.** O WPE WebKit `webkit-2248` reproduziu a perda de altura (200×667 stale vs 200×267 do fix) e permitiu validar a correção antes de qualquer deploy — com a ressalva honesta de que a estrutura real truncada não falhou no WPE e o Apple WebKit do relator falha.
