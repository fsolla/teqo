# Impl: OPS66 — deploy: build de geração estática lê schema novo antes do passo migrate (deadlock de migrations em caminho estático)

Status: registrado
Atualizado em: 2026-08-18
Issue: #(a criar — OPS66)
Priority: P2
Appetite: ~0,5 dia

## Problema (incidente real de 2026-08-18)

O deploy do S2 (migration `20260818_111748_add_social_feed_settings`, global lida pela home em geração estática) **deadlockou todos os deploys** de main a partir do merge do S2:

1. O `Dockerfile` (estágio `builder`) roda `pnpm exec next build` **direto** (não `pnpm build`) — sem auto-migrate dentro da imagem.
2. O `scripts/deploy-homeserver.sh` migra **depois** do build (`build → push → swap → migrate → rollout`).
3. A home é SSG e lê o `social_feed_settings` (código do S2) — sem a tabela, o build falha: `relation "social_feed_settings" does not exist`.
4. O passo migrate nunca roda → a tabela nunca existe → **todo deploy falha no build para sempre** até alguém rodar o migrator manualmente (feito em 2026-08-18: `docker build --target migrator` + `docker run --rm --network stack_default --env-file ~/stack/teqo-1313.env localhost:5000/teqo-1313-migrator:<sha>`).

Migrations anteriores não mordiam porque as tabelas lidas na geração estática já existiam em prod; o S2 criou a primeira tabela NOVA lida por rota estática.

## Correção proposta (a validar no gate)

1. **Ordem no deploy**: rodar o `migrate` (serviço `teqo-1313-migrate`) **antes** do build — o build precisa do schema novo; o migrator é a imagem do SHA novo, mas o estágio `migrator` não roda `next build` (só `pnpm migrate`), então builda mesmo com schema antigo. Alternativas: (a) pré-checagem `payload migrate` antes do build da imagem runner; (b) manter a ordem e documentar o run manual do migrator para migrations em caminho estático.
2. **Teste**: pin unit do script (ordem das fases) + smoke manual.
3. **Runbook**: adicionar a falha conhecida (sintoma: `relation ... does not exist` no build) com o tratamento manual.

## Não escopo

- Não mudar a arquitetura de geração estática da home.
- Não mexer nas migrations já aplicadas.
