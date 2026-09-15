# OPS110-F1 — `agent:session`: flags desconhecidas fail-high, single-flight do `start` testado e polish de help/list

Status: rascunho
Atualizado em: 2026-09-15
Issue: (a registrar — OPS110-F1)
Intenção: entrega OPS110 (Issue #1019, `docs/plans/ops110-attach-detach-runs-agent.md`) — débitos do ciclo `/simplify` capturados após o merge
Appetite restante: ~1 dia eng (3 fases, fill-in)

## Leitura da intenção

- **Outcome:** fechar as lacunas deixadas pelo ciclo OPS110 sem mudar o contrato de produto: (a) flags desconhecidas no CLI `agent:session` passam a falhar alto (hoje `--prupose=next` cai silenciosamente no default `new`, criando sessão sem driver); (b) o invariante "nunca dois runs no mesmo branch" (D5/R4 do impl plan) ganha pin automatizado do single-flight (`acquireStartLock` + reuso dentro do lock); (c) help/`list` ficam completos (flags `--hostname/--port` e obrigatoriedade do `--model` no USAGE do `start`; `logPath` visível no `list` humano).
- **O que NÃO negociar:** o contrato de `list --json` (OPS109), o fail-closed de bind, a credencial só por env e o comportamento de attach/detach (fechar cliente não encerra; `stop` é explícito) ficam como estão.
- **O que reavaliar:** nenhum achado de access/LGPD/schema.

## Abordagem recomendada

**Opções:** A) 3 fases curtas no mesmo lote (flags → teste do lock → help/list) | B) só a fase de flags agora e o resto defer | C) unificar tudo num refactor do CLI.
**Recomendação:** A — as três são cheap_polish na mesma superfície (`scripts/agent-session.mjs`) e o lote cabe em ~1 dia; a fase 1 é a de maior risco (falha muda no caminho crítico), a 2 pin o invariante mais caro de reverter (dois runs no mesmo worktree), a 3 é cosmético.
**Rejeitadas:** B — deixa sem pin o único invariante de segurança de processo do item; C — sem ganho, o CLI já foi extraído na OPS110.

### Fases verificáveis

1. **Flags estritas (F1).** `scripts/agent-session.mjs`: validador de flags aceitas por verbo (whitelist: `serve` hostname/port; `start` purpose/dir/model/issue/argument/new/hostname/port; `attach` session/branch/issue; `stop` idem; `list` json) — desconhecida → `die` com sugestão da mais próxima (distância 1) ou listando o USAGE. Unit novo do validador (puro, em `scripts/lib/agent-session.mjs`) + `pnpm gate:fast`. ~2–3h.
2. **Single-flight com seam testável (F2).** Extrair de `cmdStart` a decisão "reusar vs criar" para uma função com I/O injetável (ex. `resolveStartDecision({ statePath, readFile, serverUrl, probeBusy, driverAlive, forceNew })`) na lib pura; unit cobre: estado vivo → reuse; estado stale (driver morto e idle) → fresh; `--new` → fresh; e o reclaim do lock com PID morto (hoje só `startLockPath` é pinado). Documentar no spec a lacuna que fica (corrida real de processos). ~3–4h.
3. **Help/list (F3).** USAGE do `start` com `--hostname/--port` e "`--model` obrigatório quando há skill"; `list` humano ganha a coluna do `logPath` (mantendo o header). Spec de `formatSessionList` atualizado. ~1h.

### Dados → forma (N/A — sem dados)

## Rabbit holes / Não escopo (engenharia)

- Refactor do CLI em módulos por verbo (a CLI fina atual é intencional).
- Persistir credencial para `list`/`attach` sem env (proibido pelo D9 da OPS110).
- Validação semântica de todos os valores de flag (ex. e-mail de branch) — fora.

## Adiado com gatilho (triage OPS110)

- **Fronteira dupla da regra "issue só no `next`" e da sanitização do bag** (`scripts/lib/worktree.mjs` na diretiva ∥ `scripts/lib/agent-session.mjs` no `purposeInvocation`): unificar no dono do ciclo de vida **quando** `plan`/`new` ganharem argumento próprio ou surgir um 3º purpose com bag/issue. Hoje há comentário cruzado nos dois pontos e pins nos dois specs.

## Explicitamente fora (skips e descartes da triage — não reabrir)

- Literal `/bug-fix` em dois donos (OPS106 × OPS110): os dois specs pinam juntos num rename; unificar acoplaria o auto-unblock ao ciclo de sessão.
- 404 no `abort` tratado como "já encerrado": semanticamente correto (sessão inexistente não está rodando).
- `stop`/`list`/`attach` dependerem de `OPENCODE_SERVER_PASSWORD` no env quando o servidor exigiu senha: decisão D9 (credencial nunca persistida); `stop` degrada para encerramento local e o hint é acionável.
- Marcador `(line truncated to 2000 chars)` commitado em `AGENTS-infra.md:15`: pré-existente em `main`, fora do diff da OPS110.
- knip não carregar `src/payload.config.ts`: P3 já ledgered (`docs/TECH-DEBT.md`).

## Riscos e mitigação

- Whitelist de flags divergir do parser `parseEqualsFlags` (que aceita `--flag` sem valor): F1 deve rejeitar flag desconhecida, não mudar a forma `=`; teste cobre `--json`/`--new` booleanos.
- F2 extrair decisão sem mover I/O para a lib: manter a lib pura (filesystem/probe entram por parâmetro).

## Aceite de engenharia

- [ ] Flag desconhecida em qualquer verbo falha com mensagem acionável (inclui `--prupose`→`--purpose`).
- [ ] Decisão de reuso + reclaim do lock pinados em unit puro; corrida real documentada como lacuna.
- [ ] USAGE do `start` completo; `list` mostra o log.
- [ ] `pnpm gate:fast` verde; sem migration/UI/access.

**Self-score decision-quality (gate ≥4):** decisões A/B/C com rejeitadas (1,0); cabe no appetite ~1 dia (1,0); rabbit holes nomeados (1,0); reusa a lib/CLI existentes sem twin (1,0); contrato OPS110 preservado (1,0) → **5,0/5**.
