# OH3 — Benchmark do snapshot completo + política de truncamento

Status: rascunho
Atualizado em: 2026-08-01
Issue: #165
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (medição/script)
Appetite: ~0,5–1 dia eng
Depends: OH2
Responsável: —

## Premissas

1. A decisão “full sync no open” depende do tamanho real do JSON — medir antes de construir o endpoint (OH4).
2. Dados locais de teste são menores que prod; o benchmark corre contra o **db local com fixtures de campanha** e reporta também a projeção para volumes de prod (435 municípios, lideranças/pledges estimados).

→ Corrija agora ou sigo com estas.

## Objetivos

- `scripts/benchmark-ops-snapshot.mjs` que monta o snapshot (mesma lógica que OH4 vai usar) e reporta: bytes JSON, gzip, tempo de query por collection, tempo total.
- Política de truncamento travada com números (ex.: `municipality_update` últimos 50/município) documentada no corpo do PR.

## Dados → decisão → apresentação

Dados: N/A — o output é uma tabela de bytes/tempo no PR, não superfície de produto.

## Abordagem proposta

- Script standalone com o mesmo guard de seeds (`assertLocalDatabase`) — **nunca** corre contra Neon.
- Usa `getPayload({ config })` e as queries que `buildOpsSnapshot` fará (OH4): counts por collection, `JSON.stringify` do resultado, gzip via `zlib`.
- Imprime tabela: collection → rows, bytes, gzip bytes, ms.
- Aceita `--rows municipality_update=50` para medir a política de truncamento.

## Fases verificáveis

### Fase 1 — Tracer: script + relatório

- **Quota:** 1 do appetite
- **Entrega:** script + run local + números no corpo do PR + decisão de truncamento escrita
- **Aceite:**
  - [ ] script recusa `DATABASE_URL` não local (mesmo padrão dos seeds)
  - [ ] relatório cobre todas as collections do escopo (municipality, leadership, vote_pledge, activity, state_deputy, organization, campaign_demand, campaign_goals, municipality_update)
  - [ ] decisão: snapshot alvo ≤ ~2 MB gzip (ou justificativa escrita se maior)
  - [ ] truncamento de `municipality_update` travado (N por município) com número medido
- **Verify:** run local do script + `pnpm gate:fast`
- **Files:** `scripts/benchmark-ops-snapshot.mjs`
- **Tamanho:** S

## Dependências

- OH2 (contrato define as collections). Reusa o guard `assertLocalDatabase` da família de seeds.

## Não escopo

- O endpoint (OH4). Persistência client. Compressão no wire (decisão de OH4/OH11 — aqui só mede).

## Rabbit holes

- **Medir “no geral” sem por-collection.** Se o snapshot estourar, não sabemos quem cortar. **Mitigação:** relatório por collection obrigatório.
- **Correr contra prod “para ser realista”.** Regra do repo: nunca Neon fora de deploy. **Mitigação:** guard + projeção documentada.

## Referências

- [`tests/helpers/assertTestDatabase.ts`](tests/helpers/assertTestDatabase.ts) (padrão de guard)
- AGENTS.md — medida Neon 2026-08-01 (ops ~4 MB; TSE ~128 MB fora)
