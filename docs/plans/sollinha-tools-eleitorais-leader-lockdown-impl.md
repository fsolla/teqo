# Impl: B180 — Sollinha: travar tools eleitorais legadas (getTopDeputies/getMunicipalityVotes) contra leader

Status: aprovado
Atualizado em: 2026-08-09
Issue: #474
Intenção: docs/plans/sollinha-tools-eleitorais-leader-lockdown.md
Appetite restante: ~0,5 dia eng (herdado); sem migration / Consent / collection / UI

## Registro de execução (2026-08-09)

- **Entrega:** `electionDataGate(ctx)` novo (`src/utilities/ai/tools/electionDataGate.ts`, `true | { error }` — try/catch do `assertCanReadElectionData` + mensagem pt-BR com fonte única); gate no topo do `execute` das 2 tools legadas (`getTopDeputies`, `getMunicipalityVotes`); `getLeadingMunicipalityCities` (B177) refatorado do inline para o helper. Nenhuma outra mudança (payload queries, bypasses justificados, prompt e registro intactos).
- **Divergência da hipótese da intenção:** nenhuma nos aceites; a decisão de extrair o helper (regra 3+ = extrair, já sinalizada na intenção) foi executada como recomendado no plano.
- **Cobertura por tests:** `tests/unit/electionToolsLockdown.unit.spec.ts` (11 testes) — helper (leader nega com o shape do chat / staff passa), as 3 tools com `ctx.user` leader + payload stub que **lança se consultado** (prova fail-closed antes de qualquer query; `getLeadingMunicipalities` com candidato não-campanha para forçar o path SQL), staff-proceeds parametrizado por coordinator/advisor/candidate com `find → { docs: [] }` (município real resolve pelo catálogo; shape vazio normal).
- **Simplify:** fixes do review aplicados — comentários de bypass das 2 tools legadas corrigidos (diziam "collection-level canReadElectionData guard", mas `overrideAccess: true` ignora a collection; o gate real agora é o `electionDataGate` no tool level); lockdown de `getLeadingMunicipalities` testado no path de payload (não só no artefato); staff-proceeds cobre os 3 papéis staff (não só coordinator). Rejeitado criar gate genérico HOF para outros domínios — só eleitorais têm lockdown aqui.
- **Triage de débitos (gate humano 2026-08-09):** S1 `resolveFederalDeputy`/`resolveFromVoteRows` (exportados, `overrideAccess: true`) não têm assert próprio — único caller é o execute gateado, sem vazamento atual. **Deferido com gatilho: se um novo caller de `resolveFederalDeputy` nascer fora de um tool gateado** (ou a família eleitoral ganhar tool nova), adicionar `assertCanReadElectionData` na resolução (espelho do loader da B177) — threadando `user` na assinatura. S2–S5 descartados (cheap_polish; score ≤2).

## Explicitamente fora (triage)

- `resolveFederalDeputy`/`resolveFromVoteRows` sem assert próprio — deferido com gatilho (S1 acima).
- Mensagem de erro duplicada entre o throw do assert e o gate — duas superfícies distintas (falha server vs feedback de chat); spec pina o shape do chat.
- Boilerplate de cast do spec, stub só de `find`, staff-test do execute da B177 — polish de teste, sem valor funcional.
- `searchEntities`/outras tools não-eleitorais para leader (intenção: fora de escopo).
- Flake `testDatabaseLease.int.spec.ts` (S2, triage B177).
- **Deferidos (registrados aqui, sem Issue):** nada novo; flake `testDatabaseLease` permanece fora de escopo (S2, triage B177).

## Leitura da intenção

- **Outcome:** `getTopDeputies` e `getMunicipalityVotes` fazem `assertCanReadElectionData(ctx.user)` no topo do `execute` (fail-closed, mesmo padrão da B177); nenhum outro comportamento muda; sem migration/Consent/collection/UI.
- **O que NÃO negociar:** leader lockdown (liderança não conversa sobre municípios/dados eleitorais no Sollinha); staff idêntico; sem mudança no system prompt.
- **O que reavaliar:** a sugestão de helper compartilhado — "2 call sites = inline; 3+ = extrair; aqui já são 3 com a nova" — é decisão desta engenharia (ver abaixo).

## Abordagem recomendada

```mermaid
flowchart LR
  R[api/ai-chat<br/>buildAITools ctx] --> T1[getTopDeputies]
  R --> T2[getMunicipalityVotes]
  R --> T3[getLeadingMunicipalities]
  T1 --> G[electionDataGate ctx<br/>novo helper compartilhado]
  T2 --> G
  T3 --> G
  G -- leader/deny --> E[{ error: 'Leitura de dados eleitorais negada.' }]
  G -- staff --> Q[payload.find<br/>comportamento atual intacto]
```

**Opções consideradas:**

- **A — Inline nas 2 tools legadas:** replicar o try/catch da B177 em `getTopDeputies` e `getMunicipalityVotes` (3 cópias no total, uma por tool).
- **B — Helper compartilhado `electionDataGate(ctx)`** em `src/utilities/ai/tools/electionDataGate.ts` (retorna `true | { error }`), usado pelas 3 tools — incluindo refatorar `getLeadingMunicipalities` para usá-lo no lugar do try/catch inline da B177.
- **C — Gate só na collection (tirar `overrideAccess`):** descartada — a Local API sem `req.user` trata como anônimo e as tools chamam `payload.find` sem contexto autenticado; `canReadElectionData` nega anônimo, então remover o bypass quebraria **staff** também (e o comentário existente já justifica o bypass: "access gated at the tool level").

**Recomendação: B.** A intenção fixa a regra 2=inline/3+=extrair e o padrão chega a 3 call sites; o texto de erro é um contrato fail-closed do chat e merece uma única fonte de verdade. `electionDataGate` é um módulo raso mas de profundidade real: centraliza o try/catch + a mensagem e encapsula o conhecimento "deny no chat = mensagem pt-BR fixa" que hoje vazaria em 3 tools. **Rejeitada:** A (3 cópias da mensagem; drift futuro no texto), C (quebra staff — a Local API das tools não carrega usuário autenticado).

### Componentes / mudanças

- **`electionDataGate`** (`src/utilities/ai/tools/electionDataGate.ts`, novo): `(ctx: AIToolContext): true | { error: string }` — `try { assertCanReadElectionData(ctx.user); return true } catch { return { error: 'Leitura de dados eleitorais negada.' } }`. Sem `server-only` (não importa payload/db-postgres em runtime — só `campaignAccess` + tipo; o guard de convenção só exige `server-only` para import de payload/next/db-postgres). Sem migration.
- **`getTopDeputies`** (`src/utilities/ai/tools/getTopDeputies.ts`): primeira instrução do `execute`: `const gate = electionDataGate(ctx); if (gate !== true) return gate`. O resto intacto (bypass justificado continua no `payload.find`).
- **`getMunicipalityVotes`** (`src/utilities/ai/tools/getMunicipalityVotes.ts`): idem — gate no topo do `execute`, antes de qualquer resolução de município.
- **`getLeadingMunicipalities`** (`src/utilities/ai/tools/getLeadingMunicipalities.ts`): substituir o try/catch inline (linhas 342–346) pelo helper; sem outras mudanças.
- **Access / Consent:** reusa `assertCanReadElectionData` (única redação da regra, `src/utilities/access/elections.ts`); nenhuma chave de Consent.
- **UI:** Impeccable A — N/A; resposta de erro já é o shape `{ error }` do chat.

### Dados → forma

N/A — sem dados novos na UI; a mensagem de deny já existe em produção na B177.

## Fases verificáveis

1. **Tracer / server** — helper + gates nas 2 tools legadas + refactor da B177; unit tests novos (`tests/unit/electionToolsLockdown.unit.spec.ts`):
   - helper: leader → `{ error }`, coordinator → `true`;
   - as 3 tools com `ctx.user` leader → `{ error: 'Leitura de dados eleitorais negada.' }` e payload stub **não tocado** (fail-closed antes de qualquer query);
   - staff-proceeds: `getTopDeputies`/`getMunicipalityVotes` com coordinator + payload stub (`find` → `{ docs: [] }`) retornam o shape vazio normal — prova que staff não mudou (nome real de município, e.g. "Feira de Santana", para os resolves puros).
2. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push`.
3. **Docs** — entrada curta em `docs/CHANGELOG-AGENTS.md` + este impl plan commitado.

## Rabbit holes / Não escopo (engenharia)

- Não criar "chat gate" genérico (HOF `withX`) para outras domains — só as eleitorais têm lockdown aqui; `calculate`/`searchEntities` etc. continuam como estão (intenção: fora de escopo).
- Não tocar no system prompt, nem em `buildAITools`/route (nenhuma mudança de registro).
- Não mexer em `searchEntities`/outras tools não-eleitorais (explicitamente fora da intenção).
- Não introduzir `server-only` nas tools legadas (não importam payload/db-postgres; o guard de convenção não pede).

## Riscos e mitigação

- **Refactor da B177 (merged ontem):** padrão idêntico, troca mecânica; mitigado por unit test do lockdown nas 3 tools + staff-proceeds.
- **Drift de mensagem:** a string de erro passa a ter uma única fonte (o helper); os testes pinam o texto nas 3 tools.
- **Gate antes da resolução de input:** leader recebe deny mesmo com município inválido — intencional (fail-closed, sem leak de comportamento).
- **Flake de CI `testDatabaseLease.int.spec.ts`:** fora de escopo, descartado no triage da B177 (S2); reavaliar se recorrer.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (2 tools legadas gateadas; leader nega; staff idêntico; sem migration/Consent/UI/prompt)
- [ ] Invariantes AGENTS/engineering-standards (access por `assertCanReadElectionData` existente; copy pt-BR; identificadores em inglês)
- [ ] Testes previstos: unit (lockdown nas 3 tools + helper + staff-proceeds) — onde o path de acesso muda
