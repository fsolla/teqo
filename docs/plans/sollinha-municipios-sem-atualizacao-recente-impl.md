# Impl: Sollinha — municípios sem atualização recente (cobertura do acompanhamento)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #526
Intenção: docs/plans/sollinha-municipios-sem-atualizacao-recente.md
Appetite restante: ~0,5–1 dia eng (herdado); sem migration / Consent / collection / UI nova

## Leitura da intenção

- **Outcome:** o Sollinha responde "quais municípios estão sem atualização há mais de X dias" no **escopo do usuário** (coordenador = estado; assessor = portfólio; leader = deny fail-closed), com contagem total, um item por município com "há N dias" (ou "nunca atualizado" no topo, estagnação máxima), limiar declarado na resposta ("sem atualização há 30+ dias") e ajustável por pergunta; refinável por região/cidade; agrupável por assessor quando pedido; links de navegação para o detalhe de cada município (B162).
- **O que NÃO negociar:** leader lockdown (fail-closed antes de qualquer query — shape do gate da B180); assessor vê só o portfólio (RBAC atual das collections, `overrideAccess: false, user: ctx.user`); "sem atualização" mede **só** `municipalityUpdate` (semântica compartilhada da família B185 — nunca `updatedAt` do município); lista exaustiva com contagem (cobertura é "tudo além do limiar", não top N); limiar sempre visível na resposta; sem estimativas de votos (assimetria intacta); sem dados eleitorais; sem write.
- **O que reavaliar:**
  1. A hipótese "fonte: `municipalityUpdate` (createdAt) × `municipality`" — o campo derivado **`municipality.lastUpdateAt`** (admin read-only, `index: true`, mantido pelos hooks de `MunicipalityUpdate` — `recomputeMunicipalityLastUpdateAt` — em create/update/delete) **já é** exatamente essa semântica, sempre consistente. Re-derivar agregando `municipalityUpdate` por município na tool seria gemiar lógica que o banco já mantém e divergir da coluna que a UI exibe. A tool lê `lastUpdateAt` direto.
  2. A recomendação da intenção de "agrupar Salvador por cidade por padrão com opção de detalhar por ZE" — tratado como decisão de forma (ver Abordagem): itens por ZE com `cidade: 'Salvador'` + instrução de prompt para o modelo resumir a capital ("Salvador: 7 das 19 zonas…"), mesmo precedente do corte "agregado na tool" da B185 (o modelo agrupa pela lista; sem modo de saída extra).
  3. Questões abertas da intenção: limiar default **30** dias (validado no gate; ajustável por `days` na pergunta); "sem atualização" = `lastUpdateAt` (derivado de `municipalityUpdate`) — opção (a) da intenção, coerente com a família.

## Abordagem recomendada

```mermaid
flowchart LR
  P[ai-chat route] --> B[buildAITools]
  B --> T[getMunicipalitiesWithoutUpdate ctx]
  T --> G[gate staff inline<br/>leader → { error }]
  G --> S[resolveAIToolScope<br/>município → Salvador → região]
  S --> Q1[find municipality<br/>escopo + access do usuário<br/>select lastUpdateAt/advisors/…]
  Q1 --> F[idade = ageInDays(lastUpdateAt)<br/>inclui null sempre; > days?]
  F --> Q2[find campaignUser<br/>nomes dos assessores]
  Q2 --> R[{ escopo, limiarDias, criterio,<br/>total, nuncaAtualizados, municipios }]
  R --> L[buildCampaignLinks<br/>municipality por slug]
```

**Opções consideradas:**

- **A — Tool nova `getMunicipalitiesWithoutUpdate`** lendo `municipality.lastUpdateAt` (fonte única derivada), filtro de recência em JS sobre dias já arredondados (`municipalitySignalAgeInDays`), escopo via resolver compartilhado extraído da B185.
- **B — Tool lendo `municipalityUpdate`** e agregando max(createdAt) por município na execução.
- **C — Filtro de recência no `where`** (`lastUpdateAt: { less_than: cutoff }` + `exists: false`), com sort nativo.
- **D — Reaproveitar `getPendingLeaderships`** (modo novo) em vez de tool nova.

**Recomendação: A** — a semântica de recência já vive em `municipality.lastUpdateAt` (o banco é o dono; a UI inteira — lista, dossier — lê esse campo; a tool leitura não re-deriva nada). O filtro em JS com `ageInDays` arredondado garante **coerência rótulo↔critério** ("há 30 dias" nunca aparece sob limiar "30+") sem depender de boundary de instante no `where`. **Rejeitadas:** B (gemia a derivação; divergiria de `lastUpdateAt` se os hooks mudassem; query mais cara), C (o `less_than` no instante cru e o rótulo em dias arredondados discordam na borda — item de 30,4 dias entraria no where mas rotularia "há 30 dias" sob um limiar declarado "mais de 30"), D (a B185 responde outro aceite — pendências de abordagem; o eixo aqui é cobertura por recência, e o modo esconderia a tool da descoberta do modelo).

### Componentes / mudanças

- **`resolveAIToolScope`** (`src/utilities/ai/tools/aiToolScope.ts`, novo): extração da resolução de escopo da B185 (2º call site da família; B186 será o 3º — regra "edit the owner, don't twin"): `resolveScope`/`resolveMunicipalities`/`ScopeMunicipality`/`ResolvedScope` de `getPendingLeaderships.ts` movidos com nomes exportados (`resolveAIToolScope`, `AIToolScopeMunicipality`, `AIToolResolvedScope`), mesmo comportamento (Salvador primeiro → município via `resolveMunicipalityName` → território por `normalizeSearchPhrase` → erro "Escopo não reconhecido…"), `overrideAccess: false, user: ctx.user`.
- **`getPendingLeaderships.ts`** (refactor): passar a importar o resolver compartilhado; remover as definições locais — comportamento idêntico, sem mudança de contrato (spec existente `pendingLeadershipsTool.unit.spec.ts` continua verde sem edição).
- **`getMunicipalitiesWithoutUpdate`** (`src/utilities/ai/tools/getMunicipalitiesWithoutUpdate.ts`, novo): factory `tool()` com input Zod `{ scope?: string, days?: number (1–365, default 30) }`; gate inline no topo do execute (2º call site do padrão staff — regra 2=inline: `if (!isStaffCampaignRole(ctx.user.role)) return { error: 'Leitura de municípios negada.' }`, shape do chat da B180); uma `find` em `municipality` (where do escopo + access automático do assessor; `select: { id, name, slug, city, region, kind, lastUpdateAt, advisors }`, `depth: 0`, `limit: 0`, `pagination: false`); partição e ordenação em JS; uma `find` em `campaignUser` para nomes dos assessores (`select: { name: true }` — `name` não é identity-gated, ver `canReadCampaignUserIdentity` aplica-se só a contact/email/phone).
- **`index.ts`** (`src/utilities/ai/tools/index.ts`): registrar `getMunicipalitiesWithoutUpdate: getMunicipalitiesWithoutUpdate(ctx)`.
- **`systemPrompt.ts`** (`src/utilities/ai/`): seção "Municípios sem atualização recente" — quando usar; **declarar sempre o limiar e o critério** devolvidos pela tool; "nunca atualizado" no topo; quando o escopo incluir Salvador, resumir a capital no início (ex.: "Salvador: 7 das 19 zonas…") e detalhar por ZE sob pedido; `escopoRestrito: true` → dizer que a lista é do portfólio; links via `buildCampaignLinks` (destination `municipality` por slug) para os citados.
- **Migration:** sem migration.
- **Access / Consent:** nenhuma chave nova; gate fail-closed via `isStaffCampaignRole` (2 call sites — inline, sem extrair HOF); leituras delegadas ao access control (`canReadMunicipality` — assessor portfólio; leader nem chega a query).
- **UI:** Impeccable A — N/A (resposta em texto no chat existente; sem superfície nova).

### Dados → forma

- Forma: **lista exaustiva em texto no chat** com contagem (`total`), itens ordenados do mais velho ao mais recente (nunca atualizados no topo), cada item com `diasSemAtualizacao`/`nuncaAtualizado` e `cidade`/`regiao`/`assessores` para o modelo agrupar sob pedido ("agrupa por assessor" = o modelo agrupa pelos nomes). **Rejeitadas:** agrupamento por cidade/assessor como modo de saída da tool (o modelo agrupa pela lista — mesma leitura, precedente B185); top N com truncamento (contrato é exaustivo: "tudo além do limiar"; o modelo comprime listas longas e sugere estreitar o escopo); percentuais/estatísticas (anti-goal da intenção).

## Decisões de engenharia

1. **Fonte de recência = `municipality.lastUpdateAt`.** Derivado pelos hooks de `MunicipalityUpdate` (create/update/delete → recompute do max createdAt por município), admin read-only, `index: true`. A tool nunca toca `municipalityUpdate`; nunca usa `municipality.updatedAt` (edição de config não é acompanhamento de campo — decisão (a) da intenção, família B185). Verificação na implementação: conferir na DB local que `lastUpdateAt` reflete o último `municipalityUpdate.createdAt` após create/delete (spec de hooks já cobre; sanity manual).
2. **Critério e coerência rótulo↔limiar.** `dias = municipalitySignalAgeInDays(lastUpdateAt)` (floor, `DAY_MS` — helper puro da família E9, reusado; não duplicar a conta). Inclui: `dias === null` (nunca atualizado — sempre, estagnação máxima) ou `dias > days` (estritamente maior). **Rejeitada:** filtro no `where` por instante (`less_than: now - days*DAY_MS`) — discorda do rótulo arredondado na borda e mistura dois relógios. O where do `find` carrega só escopo (região/cidade/nome); recência é partição em JS sobre ≤435 docs — custo irrelevante.
3. **Ordenação.** Partição "nunca atualizado" primeiro (nome asc como desempate determinístico), depois por `lastUpdateAt` asc (mais velho primeiro; desempate nome asc). Determinística e testável — a resposta do modelo segue a ordem devolvida.
4. **Gate.** Inline (2 call sites da família hoje — 1 por tool): `isStaffCampaignRole` → senão `{ error: 'Leitura de municípios negada.' }`. **Rejeitada:** extrair HOF estilo `electionDataGate` (B185 registrou a mesma escolha; 2 sites ainda não justificam — revisitar na B186, 3º da família).
5. **Escopo compartilhado.** Extração da B185 para `aiToolScope.ts` — comportamento idêntico (ordem Salvador→município→território, acento-tolerante), tipos nomeados. B185 passa a importar; contrato da tool da B185 inalterado (spec existente cobre a regressão).
6. **Assessores.** `municipality.advisors` (hasMany → campaignUser, ids com depth 0) + lookup de nomes em `campaignUser` com `overrideAccess: false, user: ctx.user` (`name` é legível por qualquer campaign user; `canReadCampaignUserIdentity` só protege contact/email/phone). Item com `assessores: [{ id, nome }]` (nome `null` só se o usuário sumiu — mantém id, sem vazar vínculo fora do acesso porque a leitura já é do ator).
7. **Topologia da resposta.** `{ escopo: { tipo, nome }, escopoRestrito, limiarDias, criterio, total, nuncaAtualizados, municipios: [...] }` — `total` = `municipios.length` (exaustivo; sem `truncado`); `nuncaAtualizados` = contagem da partição "nunca" (o modelo usa para o resumo de Salvador). `criterio` declara a definição com o limiar interpolado (ex.: "Municípios sem atualização de acompanhamento há mais de 30 dias (última atualização registrada); nunca atualizados contam como estagnação máxima.").

## Fases verificáveis

1. **Tracer / server** — `aiToolScope.ts` (extração) + refactor da B185 + `getMunicipalitiesWithoutUpdate.ts` + registro no `index.ts` + seção no `systemPrompt.ts` + unit tests novos (`tests/unit/municipalitiesWithoutUpdateTool.unit.spec.ts`):
   - gate: leader → `{ error: 'Leitura de municípios negada.' }` com payload stub **intocado**; coordinator/advisor passam;
   - critério: `lastUpdateAt` com 31+ dias sob `days: 30` → incluído; ≤30 dias → excluído; `null` → incluído sempre, no topo; `days: 15` respeitado; ordem: nunca primeiro, depois mais velho→recente;
   - escopo: "Vale do Jiquiriça" (sem acento) → where `region: 'Vale do Jiquiriçá'`; "Salvador" → where `city: 'Salvador'`; município por nome; escopo inválido → mensagem de erro; sem escopo → where `{}` com `overrideAccess: false, user: ctx.user`;
   - assessores: nomes populados via segunda query `campaignUser` (`vi.fn().mockResolvedValueOnce` sequencial);
   - shape: `total` = lista exaustiva; `nuncaAtualizados` correto; `limiarDias`/`criterio` presentes;
   - regressão: spec `pendingLeadershipsTool.unit.spec.ts` verde sem edição (extração não mudou contrato).
2. **Gates** — `pnpm gate:fast` na iteração; sanity manual: `lastUpdateAt` reflete o último update (criar/excluir update na DB local e conferir a coluna); entrega com `pnpm push`.
3. **Docs** — entrada curta em `docs/CHANGELOG-AGENTS.md` + este impl plan commitado.

## Rabbit holes / Não escopo (engenharia)

- Não criar gate genérico HOF nem helper de recência novo (`municipalitySignalAgeInDays` existe — família E9; não duplicar).
- Não tocar em `buildCampaignLinks`/`campaignNavigationUrls` (destinos `municipality`/`municipalityList` já existem; sem sort novo na lista).
- Não usar `updatedAt` do município nem `votePledge.lastPledgeAt` (o sinal E9 é outra semântica — a intenção B189 fixa só `municipalityUpdate`).
- Sem paginação/limite (`truncado`) — contrato exaustivo; sem estatísticas/percentuais.
- Não mudar o shape `{ error }` do chat nem o route `api/ai-chat`.
- Não editar outras Issues `in-progress`; não tocar migrations (nenhuma).

## Riscos e mitigação

- **Extrair o resolver da B185 quebra a tool em produção?** Comportamento idêntico copiado com nomes exportados + spec existente da B185 cobre a regressão sem edição; refactor mecânico.
- **Lista exaustiva longa (coordenador, DB esparso):** até ~435 docs de um `find` barato (indexado, select enxuto); o modelo comprime a resposta (prompt instrui: contagem + mais antigos + sugerir estreitar escopo) — contrato de produto mantido (total sempre presente).
- **Borda rótulo↔limiar:** eliminada pela partição em JS com dias arredondados (Decisão 2) — teste unitário com 30,4 dias e `days: 30`.
- **`lastUpdateAt` defasado na produção:** o hook recomputa em create/update/delete de updates; se algum dia um update for inserido fora do runtime (SQL direto), a coluna pode desatualizar — mesma janela de risco da UI (aceita; a família usa o mesmo campo).
- **Salvador resumido pelo modelo:** cobertura de produto via prompt (item ZE com `cidade`); se o modelo falhar em resumir, a lista ZE-a-ZE ainda é exaustiva e correta — aceite não depende do resumo.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (perguntas "quais municípios sem atualização há mais de X dias" no escopo do usuário, contagem total, item por município com "há N dias"/"nunca atualizado" no topo, limiar declarado e ajustável, refinável por região/cidade, agrupável por assessor, links B162, RBAC atual, leader deny fail-closed)
- [ ] Invariantes AGENTS/engineering-standards (overrideAccess: false + user; copy pt-BR; identificadores em inglês; sem migration/Consent; lista exaustiva com contagem; "sem atualização" = `municipalityUpdate` via `lastUpdateAt`)
- [ ] Testes previstos: unit (gate fail-closed, critério + borda, ordem, escopo acento-tolerante, assessores, shape exaustivo, regressão B185)
