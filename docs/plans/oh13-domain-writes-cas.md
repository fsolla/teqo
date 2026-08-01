# OH13 — Writes CAS por domínio: leadership, stateDeputy, activity, demand

Status: rascunho
Atualizado em: 2026-08-01
Issue: #176
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — mesmos controles, estados novos offline
Appetite: ~2–3 dias eng
Depends: OH10, OH12
Responsável: —

## Premissas

1. Padrão estabilizado em OH6/OH10 — agora com 3+ call sites, avaliar extração de helper `*Cas` (regra do repo).
2. Cada write respeita access por papel (advisor scoped, coordinator/candidate unrestricted) — o CAS é adicional, nunca substitui RBAC.
3. Sem migration: todas estas writes usam collections existentes.

→ Corrija agora ou sigo com estas.

## Objetivos

- Actions `*Cas` + outbox para as writes staff de maior valor offline: criar/editar `leadership` (campos staff), `stateDeputy` (vínculos), `activity` (campos principais), `campaign_demand` (decisões/escopo staff).
- Se o padrão se repetir: helper `runCampaignCasMutation` (ou nome melhor) extraído com 3+ call sites reais.

## Dados → decisão → apresentação

Dados: N/A.

## Decisões travadas

- **Mesmo padrão CAS por doc (`updatedAt`).** **Rejeitado:** CAS por coleção inteira; versão própria por domínio.
- **Escopo por valor em campo (decisão de produto):** leadership, stateDeputy, activity, demand — as 4 que o staff toca em movimento. **Rejeitado:** todas as writes de uma vez (appetite); incluir `organization` (baixa frequência — adiado).
- **Helper só após 3 call sites.** **Rejeitado:** abstração desde a primeira write (regra do repo).

## Abordagem proposta

Componentes:

- **Schemas:** `baseUpdatedAt` opcional nos zod de input de cada domínio.
- **Actions:** variantes CAS nas actions existentes de `leadership`, `stateDeputy`, `activity`, `campaignDemand` ([`src/app/(campaign)/campanha/actions/`](<src/app/(campaign)/campanha/actions/>)).
- **Outbox:** `mutationFn`s novas; chaves por doc.
- **Controles/forms existentes** (criar liderança, editar vínculos, decisão de demanda): caminho outbox com flag ON.
- **Helper (condicional):** se o 3º call site confirmar o padrão, `src/app/(campaign)/campanha/actions/runCampaignCasMutation.ts` com pins.

## Fases verificáveis

### Fase 1 — Tracer: leadership + demand

- **Quota:** ~0,5
- **Aceite:**
  - [ ] criar/editar leadership offline → pending → aplica; conflito com escolha
  - [ ] decisão de demanda offline → pending → aplica; access advisor respeitado (pin int)
- **Verify:** `pnpm gate:fast` + int CAS + e2e flaky
- **Files:** schemas, actions, outbox, specs
- **Tamanho:** M

### Fase 2 — stateDeputy + activity + helper

- **Quota:** ~0,5
- **Aceite:**
  - [ ] vínculos offline aplicam; conflito UI
  - [ ] campos de activity offline aplicam
  - [ ] helper extraído **só se** 3+ call sites (senão, nota no PR por que não)
- **Verify:** `pnpm gate:fast` + int + e2e
- **Files:** idem + helper condicional
- **Tamanho:** M

## Dependências

- OH10 (padrão), OH12 (listas onde os controles vivem). Reusa actions e access existentes por domínio.

## Não escopo

- `organization`, `campaignInvite`, import CSV, tasks de activity (arrays server-derived), LGPD/consent flows.

## Rabbit holes

- **CAS em arrays derivados server-side (tasks/updates de activity).** Server deriva — não CASar o que o server computa. **Mitigação:** só campos escalares editáveis.
- **“Cobrir tudo” da collection.** Só campos staff editáveis nos forms actuais.

## Referências

- [`src/app/(campaign)/campanha/actions/`](<src/app/(campaign)/campanha/actions/>)
- OH6/OH10 (padrão)
- AGENTS.md — access por papel, transações
