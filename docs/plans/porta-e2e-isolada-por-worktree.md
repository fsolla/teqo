# Isolar a porta do e2e por worktree (e2e não deve disputar a porta 3000)

Status: rascunho
Atualizado em: 2026-08-09
Issue: #464
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem superfície de usuário; infra de dev/teste)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (dois e2e em paralelo em worktrees diferentes não colidem)
Responsável: —

## Intenção

O provisionamento por worktree (`pnpm worktree next` / `plan`) isolou o **banco** de teste corretamente — cada worktree ganha `teqo_wt<slot>_test` — mas o **e2e em si continua caindo sempre na porta `3000`**. O script grava `PLAYWRIGHT_BASE_URL` no `.env.local` (que o `playwright.config.ts` **não lê**), e omite do `.env.test.local` (que ele lê). Resultado: quando dois agentes rodam `pnpm test:e2e` em worktrees paralelos, os dois sobem `pnpm dev` na mesma porta `3000` → um trava com porta ocupada e os dois disputam CPU do mesmo dev server. Os registros do repo (“dois worktrees com dev server ativo”, “load ~40–58”, “contenção do sandbox com múltiplos dev servers em paralelo”) são a assinatura disso rondando as entregas. Faltou meia linha.

## Persona e fluxo

- **Persona / contexto:** agente (ou humano) de paralelismo rodando a suíte e2e como gate entrega, enquanto outros worktrees estão vivos no mesmo host.
- **Job principal:** rodar `pnpm test:e2e` no meu worktree sem depender do que outros worktrees estão fazendo no host.
- **Fluxo desejado:** cada worktree roda e2e contra o **seu** banco de teste (`teqo_wt<slot>_test`) **e na sua** porta (`3100+slot`) → dois runs paralelos não se veem.
- **Anti-goals de produto:** não criar autenticação/rota/DB novo; não mexer em contrato de URL público; não virar “runner distribuído”.

## Objetivo e aceite

- Rodar a suíte e2e em dois worktrees diferentes ao mesmo tempo, no mesmo host, termina **sem** `EADDRINUSE` / sem um run falar com o servidor do outro.
- O run e2e de cada worktree usa o banco e a porta derivados do slot do próprio worktree — nada de `3000` como queda.
- O dev server do e2e (webServer do Playwright) continua amarrado ao banco de **teste**, nunca ao banco dev ou prod.

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados; é isolamento de ambiente de teste.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (bloco de escrita do `.env.test.local` no `provision`); `playwright.config.ts` (`baseURL` já lê `PLAYWRIGHT_BASE_URL`, com fallback `3000` — o que precisa é a variável chegar lá).
- **Precedente a olhar:** `tests/helpers/assertTestDatabase.ts` já aceita `teqo_<worktree>_test`; `.env.test.local` já carrega `NEXT_PUBLIC_SITE_URL` na porta do slot — só a `PLAYWRIGHT_BASE_URL` ficou de fora.
- **Risco de acoplamento:** porta do e2e = porta do dev do worktree (já derivada e determinística); não inventar um segundo domínio de porta só para o e2e.

## Dependências

- Nenhuma.

## Fora de escopo

- Isolar o Vercel Blob compartilhado entre e2e de worktrees paralelos (upload com chaves determinísticas por fixture) — comportamento pré-existente, overwrite silencioso; abrir item próprio se virar problema medido.
- Isolamento do caminho _sem Docker_ (fallback Cursor Cloud): já documentado que degrada para `teqo/test` e porta compartilhada — não é o alvo deste item.
- Qualquer mudança nos contratos de URL/rota ou no próprio `playwright.config.ts` além do necessário para a variável chegar.

## Rabbit holes de produto

- **“Isolar também o Blob / o tmp / os workers”** — escopo explode para uma conta de runner gigante. **Corte neste item:** só a porta; Blob/tmp viram item próprio se medirem conflito real.
- **“Reescrever o fluxo de env do playwright”** — não precisa: a variável certa já existe e o config já a lê com antecedência.

## Questões em aberto (produto)

- **Apontar o e2e para a porta do dev do worktree (`3100+slot`) ou para uma porta distinta?** **Opções:** A) reusar a porta do slot do worktree (já provisionada, determinística, e o `.env.test.local`/`NEXT_PUBLIC_SITE_URL` já apontam nela) | B) segunda faixa de portas só para e2e. **Recomendação:** A — o domínio de colisão já é único (`slot`), duplicar a faixa só cria segundo estado a reconciliar. _(assumido — validar com o dono do provisionamento)_

## Referências

- GitHub Issue #464
- `playwright.config.ts:11-27` — só carrega `.env.test` + `.env.test.local`; `baseURL = PLAYWRIGHT_BASE_URL ?? http://localhost:3000`
- `scripts/worktree.mjs:250-279` — `.env.local` recebe `PLAYWRIGHT_BASE_URL` (linha ~256); `.env.test.local` **não**
- `.agents/skills/local-database/SKILL.md` — documenta o que o provisionamento escreve (e replica o gap)
- Registros do sintoma em vários planos: “dois worktrees com dev server ativo”, “contenção do sandbox com múltiplos dev servers em paralelo”
