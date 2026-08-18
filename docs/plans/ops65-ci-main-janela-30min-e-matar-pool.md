# CI do main em janela de 30 min + matar o agent-pool

Status: entregue
Atualizado em: 2026-08-18
Issue: #64
Priority: P0
Model: composer-2.5
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

A workstation (Ryzen 7 7800X3D, 16 threads) é o runner self-hosted do Forgejo —
e está **saturada** (load ~12.8/16) porque a CI inteira do `main` roda **a cada
push** (merge em `main` → 5 jobs concorrentes: static/int/build/e2e×2), somada
ao tick do agent-pool a cada 10 min, que faz `pnpm install --frozen-lockfile`
completo **144×/dia** para rodar um script Node puro que não usamos mais.

Antes, no GitHub, o CI de deploy na `main` só rodava em cooldown (15 min, OPS16);
hoje cada merge dispara build+test+e2e+deploy imediatamente, e a workstation paga
o custo que o GitHub pagava. Queremos:

1. **Matar o agent-pool** (não usamos; o schedule `*/10` é o maior custo contínuo).
2. **CI do `main` em janela fixa de 30 min**: o pipeline inteiro (verificador +
   deploy) só roda a cada 30 min, e pula a suite quando não há mudança de
   produção desde o último deploy — dias quietos custam ~segundos, não ~15 min
   de build.

## Persona e fluxo

- **Persona / contexto:** o dev (humano) trabalhando na workstation — a máquina
  é ao mesmo tempo o ambiente de trabalho (opencode, browser, desktop) e o runner
  da CI. Quando a CI satura, o trabalho dele engasga.
- **Job principal:** conseguir trabalhar na máquina sem que a CI do repo a
  monopolize — e receber um sinal honesto de "nada a fazer" em vez de 5 builds
  desnecessários.
- **Fluxo desejado:**
  1. Dev mergeia um PR em `main` (o PR já passou pelo gate `ci-pr.yml`).
  2. Em até 30 min, o `ci.yml` roda na janela agendada: compara o HEAD de `main`
     com o SHA da imagem rodando no homeserver.
  3. Sem mudança de produção (só docs/scripts/skills/AGENTS/etc.) → suite e
     deploy viram "skipped"; o run fica **verde** (CI concluiu: nada a fazer).
  4. Com mudança de produção → suite full + deploy na mesma janela.
  5. Deploy manual continua disponível (workflow_dispatch) a qualquer momento.
- **Anti-goals de produto:** não remover a verificação do `main` (o `ci.yml`
  continua sendo o verificador pós-merge); não perder o deploy gated; não
  adicionar segundo mecanismo de deploy fora do pipeline.

## Objetivo e aceite

- `agent-pool.yml` removido (sem schedule `*/10`; scripts/skills/docs do pool
  podem ficar, dormentes).
- `ci.yml` em `main` dispara por schedule `*/30` + `workflow_dispatch` (não mais
  a cada push).
- Job de gate barato (~segundos, sem pnpm) classifica "mudança de produção" e
  pula a suite quando não há; run fica verde com jobs skipped.
- Deploy de produção continua gated pelo verificador verde e acontece em até
  30 min após o merge (ou imediato via dispatch).
- Custo da workstation cai: dias sem merge ≈ 48 runs de segundos; dias de merge
  ≈ no máximo 1 suite full/30 min.

## Dados (intenção)

- **Vou apresentar dados?** Não — é infra/CI.
- **Decisões desbloqueadas:** o operador decide quando deployar (janela automática
  ou manual); sem métrica de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.forgejo/workflows/ci.yml` (trigger schedule + job `check`),
  `.forgejo/workflows/agent-pool.yml` (remover), `scripts/deploy-homeserver.sh`
  (guard de idempotência "already deployed"), runbook `docs/ops/teqo-1313-deploy.md`.
- **Precedente a olhar:** `ops53-ci-deploy-homeserver*.md`, `ci-deploy-cooldown*.md`
  (cooldown antigo do GitHub), `.dockerignore` (fonte da verdade do que entra no artefato).
- **Risco de acoplamento:** a classificação "mudança de produção" deve seguir o
  `.dockerignore` (o que não entra na imagem não justifica build novo); mudança em
  `Dockerfile`/`deploy-homeserver.sh` conta como produção.

## Dependências

- Nenhuma (independente; não depende de OPS62/63/64).

## Fora de escopo

- Repo público → privado no Forgejo (nota de segurança, item separado).
- Mover a CI para VPS/homeserver (decisão futura; homeserver é i7-4710MQ 2014 —
  ruim para build pesado).
- Remover scripts/skills/docs do pool (deixar dormentes).

## Rabbit holes de produto

- **Reimplementar cooldown estilo GitHub (defer+requeue).** Re-rodar o workflow
  a cada cooldown recria exatamente o custo que queremos eliminar na workstation.
  **Corte:** janela fixa de 30 min + gate barato; sem requeue.
- **Fazer o run ficar cinza quando "nada a fazer".** A agregação do Forgejo só
  mostra cinza se TODOS os jobs forem skipped — e o job `check` que classifica
  sempre roda (verde). **Corte:** run verde com jobs da suite skipped (decidido
  com o humano).
- **Classificação fina por "tipo de arquivo" custom.** **Corte:** usar o
  `.dockerignore` como fonte da verdade — é exatamente o que define o artefato.

## Questões em aberto (produto)

- Nenhuma (decisões tomadas com o humano na sessão: janela 30 min; run verde com
  chips skipped quando nada a fazer; matar o pool).

## Referências

- Sessão de diagnóstico 2026-08-18 (load 12.8; pool tick 144 installs/dia;
  cache save tar+zstd ~880% CPU; homeserver i7-4710MQ 2014).
- `docs/plans/ops50-ci-github-para-forgejo*.md` (runner workstation, capacity 3).
- `docs/plans/ci-deploy-cooldown-15min*.md` (cooldown antigo GitHub).
- `docs/ops/teqo-1313-deploy.md` (runbook do deploy homeserver).
