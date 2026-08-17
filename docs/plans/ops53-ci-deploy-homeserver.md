# Etapa de deploy no CI para o homeserver (container `teqo-1313`)

Status: registrado
Atualizado em: 2026-08-17
Issue: #8
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

Produção do site 1313 já roda no homeserver (`jorgesolla1313.com.br`, container
`teqo-1313` na porta loopback 1313 → túnel Cloudflare), mas o deploy é **manual**:
a imagem `teqo-1313:<sha>` é construída e tagada à mão, e o compose
(`~/stack/docker-compose.yml` no homeserver) aponta `pull_policy: never` para ela.
Com o deploy Vercel removido, mergir em `main` valida o código mas **não publica
nada**: o site continua na última imagem manual até alguém lembrar de builder+publicar.

Queremos uma etapa de deploy no CI Forgejo: quando o `ci.yml` (verificador) fica
verde em `main`, o pipeline constrói a imagem standalone (Node 24), publica no
registry local do homeserver (`casa:5000`), aplica migrations pendentes e faz o
rollout do container — sem passo manual além do `git push` (e sem build no laptop).

Este é o pré-requisito que os planos OPS51 (Neon→homeserver) e OPS52
(Blob→Garage) apontam como "o pipeline Forgejo→homeserver precisa existir para o
deploy do novo apontamento".

## Persona e fluxo

- **Persona / contexto:** o dev (humano) que entrega em `main`; a equipe de campanha usando `/campanha` no 1313 sem perceber a troca.
- **Job principal:** mergir em `main` == publicar no site 1313, com CI verde e rollback rápido se algo falhar.
- **Fluxo desejado:**
  1. `git push` para `main` → full suite verde (`static/int/build/e2e/checks`).
  2. Builder gera a imagem standalone (Node 24) tagada com o SHA do commit.
  3. Imagem publicada no registry local do homeserver (`casa:5000`).
  4. No homeserver: migrations pendentes aplicadas contra o `teqo_1313` (comando dedicado, NÃO o `payload migrate` embutido do `pnpm build`).
  5. Container `teqo-1313` recriado com a imagem nova; smoke pós-deploy (login, WebAuthn, convites, `api/revalidate`).
  6. Fail → rollback rápido para a imagem anterior + falha visível no status.
- **Anti-goals de produto:** build nunca no laptop do desenvolvedor; não depender de Vercel de volta; não aplicar schema migration contra produção fora do passo 4; não deixar o site fora do ar por partida fracassada sem saída documentada; não publicar nenhuma imagem sem o full suite verde.

## Objetivo e aceite

- `git push` em `main` verde ⇒ site 1313 atualizado (container novo com o SHA do commit), sem nenhum passo manual.
- Migrations pendentes aplicadas contra o banco de produção **antes** de o container novo subir (ordem: migrate → rollout), e smoke passando depois.
- Rollback documentado e executável: a imagem anterior continua disponível no registry e o caminho de volta é re-tag / `up` (runbook simples, pode ser manual).
- Zero regressão para o site público durante o rollout (janela de downtime aceitável = a do `docker compose up`/recreate, ou zero-downtime se o padrão permitir).
- Fracasso do deploy deixa status vermelho no commit e **não** publica metade; os logs do job ficam acessíveis.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** nenhuma de produto — infra/operacional.
- **Forma:** N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:** novo job em `.forgejo/workflows/ci.yml` (ex.: `deploy` após `checks`, com guard de HEAD + cooldown análogo ao que o Vercel job tinha); Dockerfile/build do runner; registry `casa:5000` (compose `~/stack`); compose `teqo-1313`/`teqo-1313-migrate` (infra-solla, fora desse repo — a mudança de infra fica no runbook); env `NEXT_PUBLIC_SITE_URL=https://jorgesolla1313.com.br`.
- **Precedente a olhar:** `plano-infra-final.md` §"Arquitetura de deploy" (build nunca no laptop → registry :5000 → migrate + pull + up); o job `deploy` Vercel que foi removido (guard de HEAD/cooldown/promote como esqueleto estrutural); `docs/plans/ops50-ci-github-para-forgejo*.md` (como o runner Forgejo executa no homeserver).
- **Risco de acoplamento:** o DB do 1313 é o `teqo_1313` (produção própria do site 1313) e a media ainda vem do Vercel Blob até OPS52 — o deploy não pode depender de OPS51/52 para funcionar.

## Questões em aberto (Opções + Recomendação)

1. **Onde o builder roda?** O runner Forgejo roda no próprio homeserver (tem Docker + registry + compose). Opções: (A) build no runner do homeserver e push direto no `casa:5000`, (B) build numa job separada que só produz artefato e um passo SSH faz o resto. **Recomendação:** (A) — minimiza movimento e o runner já vive no host; vagar a segurança do build (buildkit, sem cache de secrets) é parte do impl.
2. **Como autentica no registry local?** `casa:5000` tem htpasswd. Opções: (A) credencial docker do registry num secret, (B) registry sem auth só na tailnet. **Recomendação:** (A) — o runner está na LAN/tailnet e o registry já tem auth; não abrir.
3. **Migrate no deploy:** Opções: (A) serviço `teqo-1313-migrate` (maintenance profile do compose) com o comando dedicado antes do rollout, (B) `pnpm migrate` no runner apontando pro `teqo_1313`. **Recomendação:** (A) — é o caminho que o compose já previu e evita rodar migrations de um processo de build.
4. **Smoke pós-deploy:** mínimos que provem o site de pé. **Recomendação:** login `/campanha` + `api/revalidate` com o secret de prod + uma rota pública 200.

## Dependências

- OPS50 (pronto — CI Forgejo e runner no homeserver operantes). Não depende de OPS51/OPS52 para existir.

## Fora de escopo

- Migração do banco Neon→homeserver (OPS51) e da media Blob→Garage (OPS52) — este item só dá o pipeline; as trocas continuam Issues separadas.
- Zero-downtime obrigatório / blue-green — aceitável janela do recreate; estratégia robusta é evolução futura.
- Multi-instância / white-label de N containers 1313 — o plano infra fala disso como decisão futura.

## Rabbit holes de produto

- Transformar o deploy em sistema opinado (blue-green forçado, autoscaler) sem necessidade real.
- Criar um "deploy button" ou UI de rollback para o dev — o runbook/script basta no primeiro appetite.