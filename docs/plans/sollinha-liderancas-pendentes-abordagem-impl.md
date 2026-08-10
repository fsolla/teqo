# Impl: Sollinha — lideranças pendentes de abordagem + assessores responsáveis (gestão)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #524
Intenção: docs/plans/sollinha-liderancas-pendentes-abordagem.md
Appetite restante: ~1 dia eng (herdado); sem migration / Consent / collection / UI nova

## Leitura da intenção

- **Outcome:** uma tool nova do Sollinha responde "quais lideranças ainda precisam ser abordadas" por território de identidade, cidade (Salvador = 19 ZE) ou município — com o **critério de pendência declarado na resposta**, responsáveis (assessores) à vista, links de navegação via `buildCampaignLinks`, RBAC atual (assessor = portfólio; leader = deny fail-closed), filtro "sem assessor" (C3) e modo "municípios sem liderança" (C4).
- **O que NÃO negociar:** leader lockdown (liderança não tem essa conversa — deny antes de qualquer query); assessor vê só o portfólio (RBAC atual via access control da collection); sem dados eleitorais na resposta; sem write tool; critério sempre visível; top N com total.
- **O que reavaliar:** a redação literal da semântica compartilhada ("status ≠ `engajado` ou sem `votePledge`") incluiria `negativo` na lista — o aceite da intenção nomeia o eixo de status como "'a abordar'/'em disputa'", e produto não aborda quem é negativo. **Corte desta engenharia: `negativo` nunca entra** (ver Decisões). Também reavaliado: a hipótese "fields: supportStatus/updatedAt/advisors, votePledge.declaredAt" — o eixo do compromisso é a **presença** de `votePledge` (leadership×municipality, unique), não `declaredAt`; recência é semântica da B186, não desta.

## Abordagem recomendada

```mermaid
flowchart LR
  P[ai-chat route] --> B[buildAITools]
  B --> T[getPendingLeaderships ctx]
  T --> G[gate staff inline<br/>leader → { error }]
  G --> S[resolve escopo<br/>município → cidade → região]
  S --> Q1[find municipality<br/>região/cidade → ids]
  S --> Q2[count+find leadership<br/>status in + escopo + sem_assessor]
  Q2 --> Q3[find votePledge<br/>lideranças × escopo → set]
  Q3 --> F[pendente = status≠engajado<br/>ou sem pledge]
  F --> Q4[find campaignUser<br/>nomes dos assessores]
  F --> R[{ escopo, criterio, total,<br/>liderancas, truncado }]
  R --> L[buildCampaignLinks<br/>liderança/município/assessor]
```

**Opções consideradas:**

- **A — Tool única `getPendingLeaderships`** com `modo` (lideranças | municípios sem liderança) e `filtro` (sem assessor), escopo livre região|cidade|município.
- **B — Duas tools separadas** (uma de lideranças pendentes, uma de municípios sem liderança).
- **C — Estender `getLeaderships`** com parâmetros de pendência.

**Recomendação: A** — a intenção foldou o C4 na mesma tool (decisão de produto já tomada: "mesma tool, mesma família de dado, aceite único 'saber o que falta no território'"); um `modo` discriminado mantém o surface enxuto (1 entrada no index, 1 descrição para o modelo) e o C4 é um modo de saída sobre o mesmo escopo. **Rejeitadas:** B (2 tools para o mesmo aceite; o modelo precisaria decidir qual chamar, e a resposta de C4 semânticamente "não tem liderança" é a mesma leitura de lacuna), C (mudaria o contrato da tool mais usada da família e o critério de pendência é default-ON, não um filtro opcional — poluiria as respostas de "quais lideranças temos em X").

### Componentes / mudanças

- **`getPendingLeaderships`** (`src/utilities/ai/tools/getPendingLeaderships.ts`, novo): factory `tool()` com input Zod; gate staff inline no topo do `execute` (1 call site — regra 2=inline, 3+=extrair; não criar helper); resolução de escopo pura local (ordem: município → cidade Salvador → território, tolerante a acento); queries todas `overrideAccess: false, user: ctx.user` (padrão da família — assessor auto-scope, sem `estimatedVotes`).
- **`index.ts`** (`src/utilities/ai/tools/index.ts`): registrar `getPendingLeaderships: getPendingLeaderships(ctx)`.
- **`systemPrompt.ts`** (`src/utilities/ai/`): seção curta "Lideranças pendentes" — quando usar a tool (perguntas de "o que falta abordar", "sem assessor", "municípios sem liderança"), obrigatório **declarar o critério devolvido pela tool** na resposta e oferecer links via `buildCampaignLinks` (liderança por id, município por slug, assessor por id quando unrestricted).
- **Migration:** sem migration.
- **Access / Consent:** nenhuma chave nova; gate fail-closed via `isStaffCampaignRole(ctx.user.role)`; leituras delegadas ao access control das collections (`canReadLeadership`/`canReadVotePledge`/`canReadMunicipality`/`canReadCampaignUsers`) — assessor portfólio, leader nem chega a query.
- **UI:** Impeccable A — N/A (resposta em texto no chat existente; sem superfície nova).

### Dados → forma

- Forma: **lista em texto no chat** (nome, municípios, status, última atualização, assessores) com total e truncamento top N — a intenção fixa "lista, não mapa; nunca % estadual; critério sempre visível". Rejeitadas: agregado por assessor na própria tool (o modelo agrupa pela lista — mesma leitura, sem modo de saída extra), estatística/percentuais (anti-goal).

## Decisões de engenharia

1. **Critério de pendência.** `pendente = status ∈ {a_abordar, em_disputa} OU (status = engajado E sem votePledge no escopo consultado)`. O eixo status é pré-filtrado no `where` (`status: { in: [a_abordar, em_disputa, engajado] }`) — `negativo` é excluído na query (fail-closed, não pode "vazar" por bug de JS). Compromisso = presença de `votePledge` (liderança×município, unique) com município no escopo; para escopo território/cidade, **qualquer** pledge dentro do escopo satisfaz o eixo (liderança tem compromisso no território). Critério declarado na resposta: `'Status "A abordar" ou "Em disputa"; ou "Engajado" sem compromisso de votos no escopo consultado.'`
   - **Rejeitadas:** (a) `declaredAt` recente no critério — recência é semântica da B186 (prioridades), que reusa a definição desta família; (b) exigir pledge em **todos** os municípios da liderança — para um território com 20 municípios isso tornaria quase toda liderança pendente e a resposta perderia a função de priorização; (c) incluir `negativo` — contradiz o aceite (só a_abordar/em_disputa) e o significado operacional do status.
2. **Gate.** Inline na tool (1 call site): `if (!isStaffCampaignRole(ctx.user.role)) return { error: 'Leitura de dados de lideranças negada.' }`. **Rejeitada:** extrair helper compartilhado estilo `electionDataGate` (regra 2=inline/3+=extrair; nenhum outro domínio staff-only de gestão existe ainda). Mensagem no shape do chat da B180.
3. **Resolução de escopo.** Ordem: (1) `resolveMunicipalityName` (aliases + acento, já canônico); (2) `normalizeSearchPhrase('salvador')` → cidade (19 ZE via `city: { equals: 'Salvador' }`); (3) território por `normalizeSearchPhrase` sobre `bahiaIdentityTerritories` (ex.: "Vale do Jiquiriça" sem acento → 'Vale do Jiquiriçá'); (4) erro `'Escopo não reconhecido: "X". Use um município, cidade ou território de identidade da Bahia.'` Sem escopo → escopo do usuário (coordenador = estado; assessor = portfólio via access control). **Rejeitada:** deixar o Payload resolver com `like` — não faz folding de acento e vazaria matches parciais.
4. **Rótulos de status.** Reuso de `supportStatusLabels` (`src/utilities/leadership/leadershipLabels.ts`, fonte canônica da UI) — **não** do `SUPPORT_LABELS` local de `getLeaderships.ts` (duplicata existente; esta tool não a propaga).
5. **`filtro: 'sem_assessor'` (C3).** `advisors: { exists: false }` no `where` (precedente do repo: `revokedAt`, `readAt`, `municipality`). **Verificação obrigatória na implementação:** `exists: false` em hasMany (join table) — validar contra a DB local com query real; fallback documentado: fetch sem o filtro + filtro JS + `count` com o mesmo where seria inconsistente, então o fallback real seria filtrar em JS e ajustar `total` pelo conjunto filtrado (nunca usar `count` com where diferente do find).
6. **Top N + total.** `count` + `find` com o mesmo `where` (sincronia garantida); `limit` default 20, max 50, sort `-updatedAt` (precedente `getLeaderships`); resposta com `total` e `truncado: true` + hint de estreitar escopo quando truncar. **Adiado (barato):** ordenação por "mais antigo primeiro" para pendentes — não muda aceite, revisitável com B186.

## Fases verificáveis

1. **Tracer / server** — `getPendingLeaderships.ts` + registro no `index.ts` + seção no `systemPrompt.ts` + unit tests novos (`tests/unit/pendingLeadershipsTool.unit.spec.ts`):
   - gate: leader → `{ error: 'Leitura de dados de lideranças negada.' }` com payload stub **intocado** (fail-closed antes de qualquer query); coordinator/advisor passam;
   - critério: a_abordar sem pledge → incluída; em_disputa → incluída; engajado + pledge no escopo → excluída; engajado sem pledge → incluída; **negativo nunca entra** (assert no `where` do stub: `status in [a_abordar, em_disputa, engajado]`); pledge fora do escopo não satisfaz o eixo;
   - escopo: "Vale do Jiquiriça" (sem acento) → where `region: 'Vale do Jiquiriçá'`; "Salvador" → where `city: 'Salvador'`; município por nome; escopo inválido → mensagem de erro;
   - C3: `where` contém `advisors: { exists: false }`;
   - C4: municípios do escopo menos os cobertos por liderança (stub com docs de liderança multi-municípios); resposta declara o critério;
   - assessores: nomes populados via segunda query `campaignUser` (stub de `find` sequencial com `vi.fn().mockResolvedValueOnce`).
2. **Gates** — `pnpm gate:fast` na iteração; verificação local do `exists: false` em hasMany; entrega com `pnpm push`.
3. **Docs** — entrada curta em `docs/CHANGELOG-AGENTS.md` + este impl plan commitado.

## Rabbit holes / Não escopo (engenharia)

- Não criar gate genérico HOF nem helper compartilhado (1 call site).
- Não mexer em `getLeaderships` (incl. não "consertar" o `SUPPORT_LABELS` duplicado — fora do escopo, nota de simplify fica no triage).
- Não tocar em `buildCampaignLinks`/`campaignNavigationUrls` — os destinos `leadership`/`municipality`/`advisor`/`municipalityList`/`leadershipList` já existem.
- Não usar `declaredAt`/recência no critério (B186), nem `estimatedVotes` (leader nunca vê; aqui nem aparece).
- Sem paginação por offset (top N + escopo menor é o contrato da intenção); sem estatísticas/percentuais.
- Não mudar o shape `{ error }` do chat nem o route `api/ai-chat`.

## Riscos e mitigação

- **`exists: false` em hasMany `advisors`:** pode não ser suportado como esperado — mitigado pela verificação local obrigatória na fase 1 (fallback JS documentado na Decisão 5).
- **Stub multi-call nos unit tests:** tools fazem 3–5 `payload.find/count` — mitigado com `vi.fn().mockResolvedValueOnce` em sequência e asserts por chamada (index ou args do where).
- **Escopo de assessor fora do portfólio:** perguntar por território que não administra devolve lista vazia/escopada (RBAC atual, fail-closed) — a resposta declara o escopo efetivo; teste com advisor + escopo fora cobre o shape vazio.
- **Divergência de critério vs texto da intenção:** o corte de `negativo` é a única mudança de produto — apresentada neste gate antes de executar.
- **Flake `testDatabaseLease.int.spec.ts`:** fora de escopo (triage conhecido); reavaliar se recorrer.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (perguntas de pendentes por região/cidade/município com critério declarado; assessores com link; C3; C4; RBAC atual; leader deny fail-closed)
- [ ] Invariantes AGENTS/engineering-standards (overrideAccess: false + user; copy pt-BR; identificadores em inglês; sem migration/Consent; top N com total)
- [ ] Testes previstos: unit (gate, critério, escopo tolerante a acento, C3, C4, nomes de assessores, where assert)
