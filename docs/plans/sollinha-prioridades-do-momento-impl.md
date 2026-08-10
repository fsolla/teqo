# Impl: Sollinha: prioridades do momento (gestão)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #525
Intenção: docs/plans/sollinha-prioridades-do-momento.md
Appetite restante: ~1 dia eng (herdado); uma tool nova read-only + módulo puro + testes; sem migration/collection/Consent/UI

## Registro de execução (2026-08-10)

- **Entrega:** `getMunicipalityPriorities` nova (`src/utilities/ai/tools/getMunicipalityPriorities.ts`) + ranking puro `src/utilities/municipality/municipalityPriorities.ts` + resolver de escopo da B185 extraído (`src/utilities/ai/tools/aiToolScope.ts`, refactor de `getPendingLeaderships` sem mudança de comportamento — 18 testes dela verdes) + registro no `index.ts` + seção no system prompt; 32 unit tests (28 ranking + 10 tool, ajustados no simplify). Mergeado via PR (Closes #525).
- **Divergências aprovadas no gate:** frescor E9 (`max(lastUpdateAt, lastPledgeAt)`) em vez da semântica B185 de só-`municipalityUpdate`; exclusão literal do "boa recente" (vale até para o balde potencial); "última palavra decide"; potencial = top 5 do escopo por `expectedVotes.central` com fallback nos válidos 2022 (artefato), fonte rotulada.
- **Revisão /simplify (3 reviewers paralelos) — fixes aplicados:**
  - **Bug real (P1):** comparador da estagnação com dois municípios nunca-sinal produzia `Infinity - Infinity = NaN` → tiebreak (prioridade alta/nome) morto exatamente no topo da lista; comparador explícito + teste.
  - **Bomb-relógio (P1):** testes da tool usavam datas absolutas contra o relógio real — iriam apodrecer ~30 dias após 2026-08-08; fixtures agora derivam de `Date.now()` (o módulo puro já pinava `agora`).
  - Fronteira da janela alinhada: módulo puro aceita update com exatamente `windowDays` (inclusivo) e a query da tool passou a `greater_than_equal` (antes `greater_than` — assimétrico); testes de fronteira nos dois lados.
  - `ultimoSinalAtrasDias` agora reporta a idade da atualização decisiva quando o item veio do balde sinal (antes E9 podia devolver `null` ao lado de "atualização ruim há 2 dias" em linha stale).
  - Identificadores do options type em inglês (`windowDays`/`reason`/`sortBy` — regra do repo; as chaves pt da resposta são o contrato B185); `MunicipalityPriorityReason` deixou de ser exportado (knip).
  - `agora: new Date(now)` passado da tool (um único relógio); `expectedVotes: { central: true }` (select estreito); `sort: '-createdAt'` removido (o módulo re-deriva o decisivo — trabalho morto); cast redundante removido; `NARROW_SCOPE_HINT` movido para `aiToolScope.ts` (vocabulário de escopo, 2 call sites); `emptyResponse` duplicado unificado em `baseResponse`; docblock órfão da extração removido; alias `ResolvedScope` removido; "estado para o coordenador" no prompt virou "coordenação/candidatura" (candidate é unrestricted); allowlist P3-D estendida com a mesma justificativa da B185.
  - Testes novos do simplify: dois nunca-sinal (NaN), exclusão-vence-estagnação, empate de potencial ordena por nome, fronteira exata 30/31 dias.

## Leitura da intenção

- **Outcome:** uma tool nova do Sollinha responde "quais devem ser minhas prioridades neste momento?" com **top N municípios do escopo do usuário**, cada item com **uma linha de evidência** (o fator que o colocou ali), o **critério de ordenação declarado na resposta**, filtro/reordenação por fator, exclusão de município com atualização recente favorável e sem sinais negativos, assessor = portfólio, leader = deny fail-closed, links via `buildCampaignLinks` (precedente B185/B162).
- **O que NÃO negociar:** leader lockdown (deny antes de qualquer query); assessor vê só o portfólio (RBAC atual via access control); sem estimativas vazando para liderança; ranking **derivado na hora** (nada persistido); sem score numérico na resposta (motivo explícito por item); leitura relativa/local (nunca % estadual absoluto); `municipality.priority` é **fator**, não o ranking inteiro.
- **O que reavaliar:** a hipótese da intenção lista `politicalTrend` como fonte — virou menção secundária na evidência, não balde (nenhum exemplo de evidência da intenção usa tendência; baldes são event-driven). A semântica B185 de "atualização recente" (última `municipalityUpdate` apenas) conflita com o frescor E9 do repo (`max(lastUpdateAt, lastPledgeAt)`); B186 usa **E9** (ver Decisões). Potencial = `expectedVotes.central` com fallback nos válidos 2022 do artefato (recomendação (A) da intenção), com corte relativo "top 5 do escopo" — sem limiar absoluto inventado.

## Abordagem recomendada

```mermaid
flowchart LR
  P[ai-chat route] --> B[buildAITools]
  B --> T[getMunicipalityPriorities ctx]
  T --> G[gate staff inline<br/>leader → { error }]
  G --> S[aiToolScope<br/>escopo região/cidade/município/todos]
  S --> Q1[find municipality<br/>select estratégico + lastUpdateAt]
  S --> Q2[find municipalityUpdate<br/>janela: municipality in + createdAt >]
  S --> Q3[aggregatePledgesByMunicipality<br/>→ lastPledgeAt por id]
  Q1 --> R[rankMunicipalityPriorities<br/>módulo puro]
  Q2 --> R
  Q3 --> R
  R --> E[buckets: sinal_desfavoravel ><br/>estagnacao > potencial]
  E --> OUT[{ escopo, criterio, janelaDias,<br/>total, prioridades, truncado }]
  OUT --> L[buildCampaignLinks<br/>município por slug]
```

**Opções consideradas:** A | B | C

- **A — Tool única `getMunicipalityPriorities` + módulo puro de ranking** (`src/utilities/municipality/municipalityPriorities.ts`), com escopo reusando o resolver da B185 extraído para módulo compartilhado.
- **B — Ranking inline na tool** (tudo dentro de `getMunicipalityPriorities.ts`), sem módulo puro.
- **C — Duas tools** (uma de urgência/sinal, uma de potencial).

**Recomendação: A** — o ranking (baldes, ordenação, evidências, exclusão) é o coração do valor e precisa de testes de unidade sem stub de payload; o repo tem padrão forte de lógica pura em módulo (precedentes `engagementLevel.ts`, `mapScaleClasses.ts`, `municipalitySignal.ts`). O resolver de escopo da B185 é comportamento sutil de ~70 linhas (Salvador-primeiro, aliases, acento) que agora terá **2 consumidores** (B189 será o 3º) — extrair para `aiToolScope.ts` é "edit the owner, don't twin"; os testes da B185 permanecem verdes (mesmo shape). **Rejeitadas:** B (testar o ranking via stub de payload embaralha o que é regra de domínio com o que é query; o módulo puro é a fronteira de teste limpa — padrão da casa), C (um só aceite "o que atacar primeiro"; o modelo não deve decidir qual tool chamar para a mesma pergunta; o `motivo` filtra dentro da tool).

### Componentes / mudanças

- **`rankMunicipalityPriorities`** (`src/utilities/municipality/municipalityPriorities.ts`, novo): módulo **puro e client-safe** (importa `municipalitySignal.ts`, `municipalityLabels.ts`, `lib/engagementLevel`, `lib/schemas/municipalityUpdate`) com os baldes, a ordenação por gravidade, a exclusão do "favorável recente" e a geração de evidência de uma linha. Entrada: linhas de município (id/nome/slug/regiao/cidade/priority/engagementLevel/expectedVotes.central/lastUpdateAt/politicalTrend.status) + `lastPledgeAt` por id + atualizações da janela + `windowDays` + filtros; saída: `MunicipalityPriorityItem[]` ordenadas — `{ id, nome, slug, regiao, cidade, motivo, evidencia, prioridade, nivelEngajamento, ultimoSinalAtrasDias, ultimaAtualizacao, potencialEstimado, fontePotencial }` (o trecho da atualização vai embutido na `evidencia` do balde sinal, não como campo separado).
- **`aiToolScope`** (`src/utilities/ai/tools/aiToolScope.ts`, novo): extração do `resolveScope`/`resolveMunicipalities` da B185 (Salvador-primeiro, `resolveMunicipalityName`, território por `normalizeSearchPhrase`, escopo do ator quando omitido) — **refatorar `getPendingLeaderships`** para consumir (mesmo shape, testes verdes).
- **`getMunicipalityPriorities`** (`src/utilities/ai/tools/getMunicipalityPriorities.ts`, novo): factory `tool()`; gate staff inline no topo (1 call site, padrão B185: `isStaffCampaignRole` → `{ error: 'Leitura de prioridades de municípios negada.' }` antes de qualquer query); leituras: municípios do escopo (`overrideAccess: false, user: ctx.user`, select estratégico + `lastUpdateAt`), atualizações da janela (`municipalityUpdate` com `municipality in ids` + `createdAt > cutoff`, select `municipality/polarity/urgent/adversarySignal/createdAt/body`, sort `-createdAt`), pledges via `aggregatePledgesByMunicipality` (helper existente — `lastPledgeAt` por id); fallback de potencial via `getMunicipalityFederalBaseline(slug).validVotesByYear['2022']` (artefato commitado, puro).
- **`index.ts`** (`src/utilities/ai/tools/index.ts`): registrar `getMunicipalityPriorities: getMunicipalityPriorities(ctx)`.
- **`systemPrompt.ts`** (`src/utilities/ai/systemPrompt.ts`): seção "Prioridades do momento" — quando usar, obrigatório declarar o critério devolvido, uma linha de evidência por item, links via `buildCampaignLinks` (município por slug).
- **Migration:** sem migration.
- **Access / Consent:** nenhuma chave nova; gate fail-closed via `isStaffCampaignRole`; leituras delegadas ao access control das collections (assessor = portfólio; leader nem chega a query; `expectedVotes` só chega a staff por `canReadCampaignStaffField`).
- **UI:** Impeccable A — N/A (resposta em texto no chat existente; sem superfície nova).

### Dados → forma

- Forma: **lista ranqueada em texto no chat** com total e truncamento top N (default 10, max 20) — a intenção fixa "lista ranqueada com motivo, não score nu"; o critério é declarado (`criterio` + `janelaDias` no shape). Sem número de score; evidência em pt-BR legível pelo modelo para parafrasear. Rejeitadas: score numérico (anti-goal explícito), grupos por motivo na resposta da tool (o modelo agrupa quando útil; `motivo` filtra por chamada), dashboard/mapa (fora de escopo).

## Decisões de engenharia

1. **Frescor/estagnação = E9, não a semântica B185.** "Estagnação" mede dias desde `max(lastUpdateAt, lastPledgeAt)` (`resolveMunicipalityLastSignalAt` — o "frescor" canônico do repo, usado na fila de alocação E9). **Divergência da hipótese B185** (que define "atualização recente" como última `municipalityUpdate` apenas): a intenção lista `votePledge` (recência de compromissos) como fonte, e um pledge recente É atividade de campanha — a evidência "sem atualização há 60 dias" seria factualmente enganosa. A evidência usa a linguagem E9 ("sem sinal há N dias" / "nunca recebeu sinal" — `formatSilenceAgeLabel`). Janela default **30 dias** (semântica da família B185, `dias` ajustável 7–90). Rejeitada: só `lastUpdateAt` (mente sobre município com pledge recente).
2. **Três baldes mutuamente exclusivos, "última palavra decide".** (1) `sinal_desfavoravel`: a **última** atualização dentro da janela tem `polarity: 'ruim'` **ou** `urgent` **ou** `adversarySignal` (flags dominam a polaridade) → evidência cita a polaridade/label + recência + trecho do body (~200 chars); (2) `estagnacao`: nenhum sinal na janela (idade ≥ janela ou nunca) → evidência `formatSilenceAgeLabel`; (3) `potencial`: `engagementLevel ∈ {null, n0, n1}` e **top 5** por potencial dentro do escopo (não repetidos nos baldes 1/2) → evidência "Potencial alto (~X) e nível N1" com a fonte rotulada (`estimativa central 2026` ou `válidos 2022`). "Última palavra": uma atualização boa/neutra recente depois de uma ruim é leitura de melhora — a mais recente manda. **Exclusão do aceite literal:** última atualização na janela `boa` e sem flags → município **fora de todos os baldes** (não aparece). Rejeitadas: somar sinais (score mágico — anti-goal), janela deslizante de N atualizações (complexidade sem evidência de necessidade), `negativo`-style de 4º balde (tendência desfavorável entra como cláusula secundária na evidência, não como balde).
3. **Ordenação por gravidade declarada.** `sinal_desfavoravel` (mais recente primeiro) → `estagnacao` (mais frio primeiro) → `potencial` (maior potencial primeiro); tiebreak `priority: 'alta'` (fator, não ranking inteiro — corte do rabbit hole) e depois nome. `ordenarPor: 'potencial'` reordena todos os baldes por potencial desc (aceite "pode reordenar"); `motivo` filtra para um balde ("só as sem atualização"). `municipality.priority` entra como menção "prioritário" na evidência + tiebreak.
4. **Potencial = `expectedVotes.central` com fallback nos válidos 2022.** Recomendação (A) da intenção: `expectedVotes.central` (2026, staff-only) é o proxy de potencial; quando ausente, fallback `getMunicipalityFederalBaseline(slug).validVotesByYear['2022']` (artefato commitado — sem query nova); a **fonte é rotulada na evidência**. Corte relativo "top 5 do escopo" entre os de baixo engajamento — sem limiar absoluto inventado, leitura local ao escopo (kernel do research). Rejeitada: só 2022 (ignora a estimativa do staff), limiar absoluto fixo (número mágico), usar `federalRankByIbgeCode` (ranking de competitividade ≠ tamanho de potencial).
5. **Módulo puro separado da tool.** `rankMunicipalityPriorities` em `src/utilities/municipality/municipalityPriorities.ts` (client-safe, sem Payload): recebe linhas e devolve o ranking — testável sem stub. Rejeitada: inline na tool (testes via stub de payload testam query, não regra).
6. **Gate e RBAC = padrão B185.** `if (!isStaffCampaignRole(ctx.user.role)) return { error: 'Leitura de prioridades de municípios negada.' }` inline (1 call site — regra 2=inline/3+=extrair); leituras todas `overrideAccess: false, user: ctx.user` (assessor auto-scoped; `expectedVotes` filtrado por `canReadCampaignStaffField`). `aggregatePledgesByMunicipality` já é o bypass documentado sobre set de ids pré-filtrado pelo ator.
7. **Escopo = extração compartilhada com a B185.** `aiToolScope.ts` exporta `resolveAIToolScope(ctx, scope)` (Salvador → cidade 19 ZE antes do município; `resolveMunicipalityName`; território por `normalizeSearchPhrase`; erro "Escopo não reconhecido"; escopo omitido = do ator). Rejeitada: copiar o resolver na B186 (twin de comportamento sutil; B189 seria o 3º — drift garantido).

## Fases verificáveis

1. **Tracer / server** — `municipalityPriorities.ts` (puro) → `aiToolScope.ts` + refactor da B185 → `getMunicipalityPriorities.ts` + registro no `index.ts` + seção no `systemPrompt.ts` + testes:
   - unit do ranking (`tests/unit/municipalityPriorities.unit.spec.ts`): baldes (ruim/urgente/adversary → sinal; idade ≥ janela ou nunca → estagnação; n0/n1/null + top potencial → potencial), exclusão do boa-recente, "última palavra decide", ordenação inter/intra baldes, tiebreak priority/nome, `motivo` filtro, `ordenarPor: 'potencial'`, janela custom, fallback 2022 rotulado, evidências (trecho, silêncio, potencial), `nivelEngajamento` label;
   - unit da tool (`tests/unit/prioritiesTool.unit.spec.ts`): leader → deny com payload stub **intocado**; coordinator/advisor passam; where das atualizações (janela + `municipality in` + `overrideAccess: false`); shape (escopo/criterio/janelaDias/total/truncado); refatoração da B185 mantém `pendingLeadershipsTool.unit.spec.ts` verde.
2. **Gates** — `pnpm gate:fast` na iteração; `pnpm push` na entrega.
3. **Docs** — entrada curta em `docs/CHANGELOG-AGENTS.md` + este impl plan commitado.

## Rabbit holes / Não escopo (engenharia)

- Não persistir ranking/score (derivado na hora — fora de escopo da intenção); não criar gate helper compartilhado (1 call site); não mexer em `buildCampaignLinks`/`campaignNavigationUrls` (destino `municipality` por slug já existe).
- Não usar `politicalTrend` como balde (só cláusula secundária na evidência quando `desfavoravel`); não incluir `federalRankByIbgeCode`; não paginar por offset (top N + escopo é o contrato).
- Não mudar o shape `{ error }` do chat nem o route `api/ai-chat`; não "consertar" nada em `getPendingLeaderships` além da troca do resolver (sem mudança de comportamento).
- Não criar limite de `potencial` configurável (fixo 5; revisitável se o produto pedir).

## Riscos e mitigação

- **Refactor da B185 (extração do escopo):** comportamento idêntico, shape idêntico — os 18 testes unitários da B185 são a rede; rodar `pnpm test` completo antes do push.
- **Stub multi-call nos testes da tool:** mesmo padrão da B185 (`vi.fn().mockResolvedValueOnce` + asserts por chamada).
- **Escopo de assessor fora do portfólio:** devolve lista vazia escopada (RBAC atual, fail-closed) com `escopoRestrito: true` — mesmo shape da B185; teste cobre.
- **Janela 30 vs 21 dias (E9):** janela de prioridade é semântica da família B185 (30, ajustável); o frio da fila E9 (21) é outro corte — não conflitam porque a janela é parâmetro declarado na resposta.
- **Divergências de produto vs texto da intenção** (frescor E9, exclusão literal do boa-recente, "última palavra decide", top 5 potencial): apresentadas neste gate antes de executar.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (top N com evidência por item; critério declarado; filtro/reordenação; boa-recente excluído; assessor = portfólio; leader deny fail-closed; links)
- [ ] Invariantes AGENTS/engineering-standards (overrideAccess: false + user; copy pt-BR; identificadores em inglês; sem migration/Consent; top N com total; módulo puro testável)
- [ ] Testes previstos: unit do ranking (baldes/ordem/exclusão/evidências) + unit da tool (gate, where, shape)
