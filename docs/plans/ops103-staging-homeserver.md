# OPS103 — Staging no homeserver com verify único e aprovações separadas

Status: rascunho
Atualizado em: 2026-09-12
Issue: #968
Priority: P1
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias eng no repo + bootstrap ops no homeserver
Responsável: —

## Intenção

_"Lets set up a staging environment. What would be the best way to do it? Can we use the same verify step for both staging and prod environment deploys? But approve each deploy separately?"_

Hoje o repo tem só dois alvos: o banco mínimo sintético (CI/PR) e produção. Uma migration só encontra o schema real no deploy de produção — o defeito de build/rollout/migração é descoberto no alvo mais caro. O staging no homeserver dá um alvo real e descartável (mesmo SHA, mesma stack, banco e bucket próprios) antes de produção.

A resposta ao "best way": sim, o `verify` é do **commit**, não do alvo — fica intocado e gateia os dois deploys num único `workflow_dispatch`; o que muda entre ambientes é o deploy. A separação de aprovações vem dos GitHub Environments: `deploy-staging` e `deploy-production` com gates independentes, e produção só depois de staging verde.

## Persona e fluxo

- **Persona / contexto:** operador do deploy (o mesmo humano de OPS102), decidindo publicar um SHA e esperando ~50 min de `verify`.
- **Job principal:** validar o SHA num ambiente real antes de aprovar produção, sem rodar o verify duas vezes.
- **Fluxo desejado:** dispatch do `deploy.yml` em `main` → `verify` full → `deploy-staging` sobe o SHA em `staging.jorgesolla1313.com.br` → humano inspeciona site/login/migração aplicada → aprova o environment `production` → `deploy-production` publica o mesmo SHA em produção. Staging vermelho = produção nunca roda.
- **Anti-goals de produto:** não é deploy automático; não é branch/PR `stage` (precedente morto); não é um segundo pipeline ou script gêmeo; não substitui o `verify`; não é ambiente com PII real.

## Objetivo e aceite

- Um único dispatch do `deploy.yml` roda o `verify` (intocado) uma vez e gateia os dois deploys: `verify` → `deploy-staging` → `deploy-production`.
- Aprovações separadas por GitHub Environments: cada deploy tem seu próprio environment; produção só roda com o `production` aprovado e depois de staging verde (`needs`).
- O mesmo script parametrizado por ambiente executa os dois deploys (edit-the-owner, sem gêmeo); invocação e defaults atuais de produção não mudam.
- Migração validada em staging antes de tocar produção: em cada ambiente a ordem migrator→migrate→runner (OPS66) é preservada.
- Falha em staging é fail-closed para produção e faz rollback só do staging.
- Guardrails: staging nunca recebe PII real; staging não é indexável; envs de staging vivem no homeserver, nunca como GitHub secrets; runner self-hosted só no deploy (nunca no PR CI); build próprio por ambiente (mesmo SHA, imagens e `NEXT_PUBLIC_SITE_URL` de cada alvo); bucket próprio.
- Runbook e docs vivos descrevem o fluxo de staging e o bootstrap ops do homeserver.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de infraestrutura de deploy; sem superfície de dados de produto.
- **Decisões desbloqueadas:** operador decide promover um SHA a produção depois de vê-lo rodando em staging.
- **Forma:** N/A — nada a apresentar.

## Dados da decisão (literais)

- ID reservado: **OPS103**; kind **chore**; sem UI (Impeccable A); slug `ops103-staging-homeserver`.
- `.github/workflows/deploy.yml`: `verify` (hosted, full, intocado) → `deploy-staging` (`environment: staging`) → `deploy-production` (`environment: production`, required reviewer `fsolla`, `needs: [deploy-staging]`); ambos os deploys restritos à branch `main`.
- Identidades de staging (novas): container/serviço `teqo-staging`, migrator `teqo-staging-migrate`, DB `teqo_staging`, env `~/stack/teqo-staging.env`, porta `127.0.0.1:1314`, imagens `localhost:5000/teqo-staging:$SHA` e `localhost:5000/teqo-staging-migrator:$SHA`.
- Produção intocada: `teqo-1313`/`teqo-1313-migrate`, DB `teqo_1313`, `~/stack/teqo-1313.env`, `127.0.0.1:1313`, imagens `localhost:5000/teqo-1313(-migrator):$SHA` — defaults atuais do script.
- `scripts/deploy-homeserver.sh`: script único parametrizado por ambiente (env file, container/serviço, DB, proxy, tags, compose, base do smoke); sem script gêmeo.
- URL pública: `https://staging.jorgesolla1313.com.br` atrás do mesmo Cloudflare tunnel (ingress novo), `NEXT_PUBLIC_SITE_URL` de staging; `noindex` (robots).
- Mídia: bucket próprio `teqo-media-staging` — nunca compartilhar o bucket de produção (`.env.example`: "never share the production bucket across environments").
- Dados de staging: sintéticos (`db:seed:minimal`/demo); PII real de apoiadores nunca entra (LGPD). Cópia de prod sem PII fica como opção futura.
- Bootstrap do homeserver (DB `teqo_staging`, serviços no compose `~/stack`, env file, bucket no Garage, ingress/DNS do tunnel) é trabalho OPS fora do repo, executado na aceitação e documentado no runbook — o executor do item não faz infra a partir do código.
- Dependência dura: OPS102 (#962) remove o guard de stale run; sem ele o deploy de produção aborta quando `main` anda durante a janela longa de promoção (verify + staging + inspeção + aprovação + prod).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/deploy.yml` (jobs + environments), `scripts/deploy-homeserver.sh` (parametrização), `tests/unit/deployScript.unit.spec.ts` e `tests/unit/ciSkipInvariants.unit.spec.ts` (pins), `docs/ops/teqo-1313-deploy.md` (runbook), `docs/AGENT-OPS.md` + `AGENTS-infra.md`/`AGENTS.md` (ladder de ambientes), `.env.example` (nota do bucket de staging).
- **Precedente a olhar:** OPS53/OPS71 (script + dispatch manual), OPS66 (build-after-migrate), OPS65 ("already deployed"), OPS102 (#962, stale guard).
- **Risco de acoplamento:** não criar script/workflow gêmeo; não tocar defaults de produção; runner self-hosted continua exclusivo do deploy; nenhuma credencial nova no GitHub.

## Dependências

- OPS102 (#962) — dura: sem a remoção do stale run, a janela de promoção ultrapassa o guard e o deploy de produção falha quando `main` anda.
- Nenhuma outra.

## Fora de escopo

- e2e automatizado contra staging (o full continua no `verify`); carga, caos, multi-região.
- Branch `stage` / PR-to-stage / promote git — precedente morto (removido 2026-08-01); não ressuscitar.
- Cópia de dados de produção para staging (opção futura, com revisão LGPD).
- Preview environment por PR.
- Compartilhar DB, bucket ou imagem entre ambientes.

## Rabbit holes de produto

- **"Staging vira um segundo pipeline."** Duplicar workflow/script "para não mexer em produção" cria drift silencioso entre ambientes. **Corte neste item:** um workflow, um script, um parâmetro.
- **"Staging com dados reais é mais útil."** Cópia de prod carrega PII de apoiadores para um ambiente novo. **Corte:** sintético no v1; cópia anonimizada só como item futuro com revisão LGPD.
- **"Já que tem staging, todo PR vai pra lá."** Recria o fluxo branch `stage`/PR-to-stage que o repo matou. **Corte:** staging é alvo de promoção de um SHA de `main`, não destino de PR.
- **"Aproveitar e cobrir e2e/integrações externas no staging."** WebAuthn/OAuth/Resend são origin-bound e exigem configuração própria; transformar staging em espelho de prod explode o appetite. **Corte:** staging valida migração/build/rollout/smoke/inspeção; o resto fica explícito como não-validado.

## Questões em aberto (produto)

- **Staging tem reviewer próprio ou o dispatch é a aprovação?** **Opções:** A) sem reviewer no environment `staging` — o dispatch manual já é ato deliberado, e a aprovação que importa é a de produção; B) reviewer `fsolla` também no staging. **Recomendação:** A, com reviewer obrigatório só em `production`; revisitar se o staging passar a receber dados menos descartáveis. _(assumido — validar com produto)_
- **Dados do staging: sintético ou cópia sem PII?** **Opções:** A) sintético (`db:seed:minimal` + demo) no v1; B) cópia de prod com scrub de PII desde já; C) snapshot congelado sem PII. **Recomendação:** A — o objetivo é validar migração/build/rollout, que não depende da forma dos dados reais; B vira item futuro quando um bug concreto exigir volume/forma de produção. _(assumido — validar com produto)_
- **Domínio público ou só localhost?** **Opções:** A) `https://staging.jorgesolla1313.com.br` atrás do mesmo tunnel, com noindex; B) apenas localhost no homeserver (acesso por túnel/SSH), sem DNS. **Recomendação:** A — inspeção humana no browser e o comportamento real do tunnel fazem parte do valor; noindex + ausência de links públicos controlam a exposição. _(assumido — validar com produto)_
- **O que o staging NÃO valida?** **Opções:** A) assumir explicitamente: e2e automatizado, carga e integrações origin-bound (WebAuthn/passkeys, Google OAuth, Resend) sem configuração própria de staging; B) tentar cobrir e2e contra staging. **Recomendação:** A — e2e continua no `verify` (que valida o commit, não o alvo); documentar os limites no runbook para ninguém confundir "staging verde" com "produção garantida". _(assumido — validar com produto)_

## Referências

- GitHub Issue #962 (OPS102 — dependência)
- `docs/plans/ops102-deploy-manual-sem-stale-guard.md` — a dependência dura
- `.github/workflows/deploy.yml` — `verify` (l.40–142) e `deploy` (l.144–159); nenhum workflow usa `environment:` hoje
- `scripts/deploy-homeserver.sh` — hardcodes a parametrizar (env files l.79–80, container l.70/72/179/196/209/214/250/261, proxy l.122–127/137, tags l.152–160/168–169/202–203, compose l.164–171, smoke l.223–234, cleanup l.252)
- `tests/unit/deployScript.unit.spec.ts` e `tests/unit/ciSkipInvariants.unit.spec.ts` — pins do script e do deploy manual-only
- `docs/ops/teqo-1313-deploy.md` — runbook (zero menção a staging); `docs/AGENT-OPS.md` l.7–12 (ladder de 2 ambientes), l.80–81, l.100, l.110; `AGENTS-infra.md` l.5, l.25
- `.env.example` l.14–23 — "never share the production bucket across environments"; `src/utilities/mediaStorage.ts` — fail-closed das 4 envs S3
- `docs/plans/paradigma-agentes-paralelos.md` l.135–185 — precedente morto de `environment: stage` + `STAGE_DATABASE_URL` (não ressuscitar)
