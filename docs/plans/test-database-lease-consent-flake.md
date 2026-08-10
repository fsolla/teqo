---
id: D9
depends: []
serializes: []
priority: P3
model: composer-2.5
model-local: deepseek-v4-flash-high
---
Plano: [`docs/plans/test-database-lease-consent-flake.md`](docs/plans/test-database-lease-consent-flake.md)

# Flake: consent restore do `testDatabaseLease` sob carga (race de fixtures paralelas)

## Intenção

`tests/int/testDatabaseLease.int.spec.ts` → **"restores the exact configured consent after deletion and recreation"** falha intermitentemente: 4× numa única sessão (todas sob máquina carregada — 8+ worktrees de agentes rodando gates em paralelo), sempre no mesmo assertion (`expected { id: 316 } to match object { id: 342 }` na key `lideranca-autopreenchimento`); o teste e os arquivos vizinhos passam juntos isolados. É race **dentro** da suíte int (um único banco `teqo_wt<slot>_test`, workers paralelos), pré-existente em `main` — não tem relação com entregas de produto; a contenção de CPU/container só alarga a janela.

## Persona e fluxo

- **Persona:** agente rodando `pnpm push`/`gate:ci` local sob o regime de worktrees paralelos (pool ativo).
- **Job:** o gate não pode falhar por race de teste; o custo atual é ~10 min por push + retries.
- **Fluxo desejado:** `pnpm test:int` estável sob carga; o assertion passa N execuções consecutivas com os arquivos suspeitos rodando em paralelo.

## Objetivo e aceite

- **Caracterizar a intercalação exata** (fase 1, read-only): o failure implica uma **segunda linha com a mesma key** no momento da leitura, apesar de `withInviteConsent`/`withMutableConsentFixture` tomarem o advisory lease (`CAMPAIGN_INVITE_CONSENT_LEASE_KEY`). Verificar: (a) algum escritor de `consent` na suíte int **não** toma o lease; (b) leituras `LIMIT 1` **sem `ORDER BY`** (`withLeasedConsent`, `withMutableConsentFixture`, `withMissingInviteConsentFixture`) podem escolher a linha errada quando existe duplicata.
- **Eliminar o flake** com o fix mais simples que a caracterização apontar:
  - `ORDER BY id` nas leituras por key (determinístico), e/ou
  - serializar o escritor faltante com o lease existente (precedente exato do `onda0Provision` — comentário "without the shared leases this test races that window"), e/ou
  - invariante de unicidade no restore (falhar com mensagem clara se sobrar duplicata da key).
- **Verificação:** `pnpm test:int` (e idealmente a combinação `testDatabaseLease` + `campaignFixtures` + `campaignInvite` + `onda0Provision` em workers paralelos) verde em várias execuções, e uma execução do gate completo.

## Dados (intenção)

- **Vou apresentar dados?** Não.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `tests/helpers/testDatabaseLease.ts` (leituras `LIMIT 1` sem `ORDER BY`; restore `INSERT … ON CONFLICT ("id") DO UPDATE`); audit de todos os writers de `consent` em `tests/int/*.spec.ts` (`campaignFixtures`, `campaignInvite`, `onda0Provision`, `submitWhatsapp`, `submitPetitionSignature`, …) contra o lease `CAMPAIGN_INVITE_CONSENT_LEASE_KEY` (e os leases irmãos de supporter).
- **Precedente a olhar:** `onda0Provision.int.spec.ts:40-68` — a mesma race foi corrigida lá com leases compartilhados; o fix do D9 provavelmente replica esse padrão no escritor que ficou de fora.
- **Contraprova a montar:** reprodução sob carga com `maxWorkers` alto + os 4 arquivos juntos (a janela é de ms — pode precisar de repetições).

## Dependências

- Nenhuma.

## Fora de escopo

- Outros flakes da suíte (não relatados nesta sessão).
- Mudanças no mecanismo de lease (advisory lock) — é a serialização canônica e funciona.
- Qualquer mudança de código de produto/`src/`.

## Rabbit holes de produto

- **"Refatorar as fixtures de consent de uma vez":** só o que a caracterização apontar; o resto fica para follow-up se surgir.

## Questões em aberto (produto)

- **Qual fix?** Decidir na execução pela caracterização (fase 1): leitura determinística (ORDER BY) é o fix mais barato e vale sozinha se o problema for escolha de linha; serializar escritor faltante vale se achar um fora do lease. As duas não são mutuamente exclusivas.

## Referências

- Sessão OPS27 (2026-08-10): 4 falhas no gate sob carga, sempre o mesmo teste; evidência `id 316 → 342`; `testDatabaseLease`/`campaignFixtures`/`campaignInvite`/`onda0Provision` tocam a key `lideranca-autopreenchimento`; `vitest.config.mts` `maxWorkers = min(8, cores)`.
