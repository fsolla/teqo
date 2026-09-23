# Escala/DRY pós-S30 — fatiar o CardComposer + resíduo do script de assets

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1271 (débito do S30; a Issue própria nasce `depends: [1271]`)
Priority: P3
Impeccable: A — refactor interno do estúdio de cards, sem mudança visual (o e2e da superfície é a prova)
Appetite: ~0,5–1 dia eng (fill-in; três fases pequenas, sem migration)
Responsável: —

## Contexto

A entrega S30 ([cards-estadual-dobradinha-impl.md](cards-estadual-dobradinha-impl.md), Issue #1271) acrescentou o 5º modelo do estúdio de cards. O gatilho do S15 para fatiar o `CardComposer` ("um 5º modelo OU folga de ~0,5 dia no próximo item do funil", [cards-time-de-voce-impl.md](cards-time-de-voce-impl.md) § Adiados) disparou; a Decisão 7 do S30 adjudicou manter o composer único no PR e registrar a dívida aqui — o arquivo saiu de ~830 para ~1100 linhas, com os ramos `processing`/`error`/`ready` inline e ternários aninhados de 3–4 níveis (`canAdvance`/`adjustable`/`eyebrow`/`title`). A passagem `/simplify` (2 revisores) aplicou ~20 correções na própria sessão (R1–R8 abaixo); o que sobrou são débitos maiores que o cleanup e do mesmo lote (mesma superfície: estúdio de cards + script de assets do S30). Sem este item: (a) cada modelo novo (o S31 já está na fila) paga o custo de mexer num arquivo de 1100 linhas com derivações sem teste; (b) o `build-state-deputy-card-assets.mjs` segue com dois passes e predicados gêmeos que podem divergir.

**Coordenação:** o S31 (#1272, colinha) também toca `CardComposer.tsx`/`StateDeputySelect.tsx`; executar este lote **depois** do S31 evita rebase (a Issue depende só de #1271, que destrava sozinho).

## Objetivos

- Os blocos de estado do composer (`processing`/`error`/`ready`, campo de nome, avisos de privacidade) vivem em componentes presentacionais com props tipadas; o `CardComposer` fica com a orquestração (estado, efeitos, canvas).
- `canAdvance`/`adjustable`/`eyebrow`/`title`/estágios de prévia viram funções nomeadas e testáveis (fim dos ternários aninhados por `kind`/estado/seleção).
- `scripts/build-state-deputy-card-assets.mjs` faz um passe único: um `Map` slug→par montado na validação, sem o 2º `readdir` nem o `pick`/`findOne` gêmeos.
- Guardrails: sem migration; nenhuma mudança de DOM/a11y/copy/URL; os 4 modelos antigos intocados; `pnpm gate:fast` + e2e `Cards personalizados` (S14/S15/S30) verdes.

## Fases

1. **F1 (S3, maior ROI) — subcomponentes de estado.** Mover os blocos `step === 'compose' && teamProcessing|teamError|teamReady` (e o campo de nome/avisos que os acompanha) para `src/components/cards/CardComposerStates.tsx`, com props explícitas e sem estado próprio, preservando literais, roles e labels. Opções: A) componentes no mesmo diretório com props explícitas | B) manter inline no arquivo | C) render-props. Recomendação: A — é o dono natural do que hoje é JSX condicional sem dono; rejeitadas B (não reduz o arquivo) e C (cerimônia sem 2º consumidor). Prova: e2e S30/S15 + unit existentes verdes, sem snapshot/DOM novo; `pnpm gate:fast`.
2. **F2 (S3) — derivações puras.** Extrair `canAdvance`, `adjustable`, `eyebrow`, `title` e os estágios de prévia para funções nomeadas (ex. `src/components/cards/cardComposerState.ts`) com unit `// @vitest-environment node` cobrindo a matriz `kind` (name/photo/team/state-deputy) × estado do recorte × seleção × erro de nome. O composer só consome o resultado. Prova: unit novo verde + e2e da superfície.
3. **F3 (S2, carona) — passe único do script de assets.** Montar `Map<slug, { dir, photos, base }>` no 1º passe (validação) e derivar do Map no 2º, eliminando o `readdir` repetido e o par `pick`/`findOne`. Prova: re-executar `pnpm build:state-deputy-card-assets -- --from '<origem>'` deixa `git status public/cards/estaduais` limpo (byte-idêntico).

## Já resolvido no simplify (não reabrir)

- **R1** `renderTeamCard` num ramo só com `subject` discriminado (fim da duplicação de ramo).
- **R2** trava de scroll programático nos dots da galeria (`PROGRAMMATIC_SCROLL_LOCK_MS`).
- **R3** opções do listbox com `tabIndex={-1}` (fim dos 53 tab stops).
- **R4** alvo dos dots 6px→24px (WCAG 2.5.8) + ordem dica→dots do design.
- **R5** picker: scroll da opção ativa ao digitar, mensagem vazia fora do listbox, autofocus só em abertura do usuário, clamp do `activeIndex`, retry ao reescolher o mesmo estadual após falha.
- **R6** `deputyPairReady` exige o par carregado; fallback morto de `photoWindow`; casts do `querySelectorAll`; `.map((file) => file)` morto no script.
- **R7** e2e: comentário dos pixels mágicos, clique nos dots via `aria-current`, nome longo do modelo novo, estado vazio da busca.
- **R8** divergências do designer (destaque do tile novo + escala da prévia S30) portadas e certificadas.

## Explicitamente fora (descartes e defers com gatilho)

- **P2 — 3ª cópia do padrão listbox inline** (`StateDeputySelect` vs `CampaignListOmnibox` vs `RelationChipCell`): **defer**, gatilho já documentado no próprio componente — 4º consumidor com implementação própria (reuso de `StateDeputySelect` não conta) ou um fix de a11y que precise valer nos três.
- **P4 — `nome · número` em 2 lugares**: **descartar** — não é o mesmo formato (legenda `nome · número`; trigger `número · Trocar` + nome em span) e são 2 call sites < 3.
- **P6 + P10 — par JULIO default morto/duplicado** (`cardModels.ts` × `stateDeputyCatalog.ts`; o composer nunca carrega os defaults e `previewSrc` cobre tile/pré-escolha): **defer**, gatilho — o S31 (#1272) acrescenta o 6º modelo e revisita o contrato `CardModel`, ou surge um 2º consumidor do par default.
- **P5 — `window` como nome de parâmetro em `cardRender.ts`**: **descartar** — pureza herdada do S15, sem bug; rename amplo (score 1) por score ≤2.
- **P7 — comentários/mensagens pt-BR no script novo**: **descartar** — família `build:*` mista (`build-radio-artes.mjs` é pt-BR) e comentário não é identificador.
- **P8 — `identitySha256` redundante após o `toEqual`**: **descartar** — precedente idêntico no `municipalityCatalog`; o hash é o guard de regeneração do fixture.
- **P9 — `!` em `tests/unit/cardRender.unit.spec.ts`**: **descartar** — convenção do próprio arquivo (test-only, pré-existente).

## Rabbit holes / Não escopo

- Extrair o listbox compartilhado agora (P2) — três superfícies divergentes (admin/omnibox, chips de relação, estúdio público) e gatilho documentado; abstração prematura.
- Mexer no contrato `CardModel`/defaults (P6) — o S31 já vai tocá-lo.
- Redesenho de prévia/segunda gramática visual, re-harmonização na troca de estadual (assumida no S30), 53 modelos/URL, CMS.
- Mudar copy/literais ou o fluxo dos 4 modelos antigos.

## Self-score (decision-quality)

1. Decisões caras com rejeitadas? **Sim** — F1/F2 com opções e rejeitadas; nada de access/LGPD/schema/unicidade entra (piso 4–5 não se aplica) e descartes/defers estão nomeados com gatilho.
2. Cabe no appetite? **Sim** (~0,5–1 dia, três fases pequenas, sem migration).
3. Rabbit holes nomeados? **Sim** — listbox compartilhado, contrato `CardModel`, re-harmonização.
4. Depth check? **Sim** — reusa composer/script existentes; F2 nasce com unit real, sem módulo de pureza especulativo.
5. Outcome do S30 intocado? **Sim** — comportamento/DOM/copy/URL idênticos; o e2e da superfície é a prova.

**Score: 5/5.**
