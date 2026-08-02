# OH10 — Writes municipality staff CAS: update, declareVotes, tendência, engagement, advisors

Status: pronto para PR
Atualizado em: 2026-08-02
Issue: #171
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — mesmos controles in-context, estados novos offline
Appetite: ~2–3 dias eng
Depends: OH7, OH9
Responsável: —

## Débitos pós-/simplify (não bloqueiam OH10)

- Toast de conflito CAS em tendência/nível da lista (só advisors + declareVotes têm escolha Manter/Usar).
- Unificar executores OH6+OH10 (já previsto em OH13).

## Freshness audit (2026-08-02)

- OH7 (#169) e OH9 (#172) `done`+`in-prod`. OH6 CAS em `estimateVotesCas` + `opsEstimateOutbox` intactos; mirror tem `updatedAt` em `OpsMunicipality` / `OpsVotePledge`.
- Actions citadas batem: `declareVotesRecord`, `createMunicipalityUpdateRecord`, `setMunicipalityPoliticalTrendRecord`, `setMunicipalityEngagementLevelRecord`, `setMunicipalityAdvisorMembershipRecord` / `assignMunicipalityAdvisorsRecord`.
- Controles B9 intactos (JSON routes + forms). Sem `baseUpdatedAt` ainda — a implementar.
- Outbox: executor OH6 fica; OH10 adiciona executor irmão (`opsMunicipalityOutbox`) com as mesmas chaves de merge — evita refactor arriscado do singleton de estimativas; OH13 pode unificar.

## Premissas

1. Padrão provado: OH6/OH7 (CAS + outbox + mirror keys).
2. Cada write ganha CAS por `baseUpdatedAt` do doc alvo; sem base → comportamento actual.
3. Engagement level continua a escrever `allocationDecision` na mesma transação (invariante E14) — o outbox só re-executa a action inteira, nunca a parte.

→ Confirmadas; a implementar.

## Objetivos

- Actions `*Cas` + outbox para: `municipalityUpdate` (create), `declareVotes`, tendência (`politicalTrend`), engagement level, atribuição de advisors do município.
- Controles in-context existentes (B9/edit-where-you-see) funcionam offline com pending/conflict, sem mudar UX online.

## Dados → decisão → apresentação

Dados: N/A.

## Decisões travadas

- **CAS por doc alvo (`updatedAt`).** **Rejeitado:** CAS por município inteiro (municipalityUpdate é append-only — base = “sem conflito” por natureza, mas mantemos o padrão para consistência: base = `updatedAt` do município pai para ordem de feed).
- **Outbox re-executa actions inteiras (idempotentes por CAS).** **Rejeitado:** decompor effects (allocationDecision) no client — regras ficam no server.
- **Advisor assignment com CAS no município.** **Rejeitado:** CAS por advisor (controle edita o município).

## Abordagem proposta

Componentes (padrão repetido por write — sem helper genérico antes de 3 call sites):

- **Schemas zod** (`src/lib/schemas/municipality*.ts`, `votePledge.ts`): `baseUpdatedAt` opcional.
- **Actions** ([`src/app/(campaign)/campanha/actions/`](<src/app/(campaign)/campanha/actions/>)): variantes `*Cas` por write, mesmo fluxo + check.
- **Outbox:** novas `mutationFn`s no executor de OH6 (mesma instância, chaves por doc).
- **Controles:** `MunicipalityListExpectedVotesControl`, `PlazaStrategyForm`-equivalentes actuais, advisor chips — caminho outbox com flag ON; form action actual com flag OFF.

## Fases verificáveis

### Fase 1 — Tracer: municipalityUpdate + declareVotes

- **Quota:** ~0,4
- **Aceite:**
  - [ ] criar update offline → pending → online → aparece no feed (sem duplicar)
  - [ ] declareVotes com base stale → conflito UI; com base igual → escreve
- **Verify:** `pnpm gate:fast` + int CAS + e2e flaky
- **Files:** schemas, actions, outbox, specs
- **Tamanho:** M

### Fase 2 — Tendência + engagement + advisors

- **Quota:** ~0,6
- **Aceite:**
  - [ ] tendência offline → pending → aplica
  - [ ] engagement: move offline grava decisão + rationale no server ao reconectar (transaction intacta; pin int)
  - [ ] advisors chips offline → pending → aplica; conflito mostra escolha
  - [ ] flag OFF: comportamento actual intacto (pin e2e)
- **Verify:** `pnpm gate:fast` + int engagement (allocationDecision) + e2e
- **Files:** schemas, actions, controls, specs
- **Tamanho:** M

## Dependências

- OH7 (padrão mirror/outbox), OH9 (detalhe). Reusa actions actuais em [`src/app/(campaign)/campanha/actions/`](<src/app/(campaign)/campanha/actions/>) e hooks E14.

## Não escopo

- Writes leadership/activity/demand (OH13). Engagement com override de hysteresis novo (regras actuais).

## Rabbit holes

- **Helper genérico “CAS action” antes de 3 writes.** Regra do repo: abstração com 3+ call sites. **Mitigação:** repetir padrão; OH13 avalia extração.
- **Decompor transaction no client.** Invariantes ficam server-side.

## Referências

- [`src/app/(campaign)/campanha/actions/`](<src/app/(campaign)/campanha/actions/>)
- [`src/lib/engagementLevel.ts`](src/lib/engagementLevel.ts)
- AGENTS.md — E14 engagement, transações
