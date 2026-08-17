# Impl: Migrar o banco de produção do Neon para o Postgres do homeserver

Status: aprovado (executado em 2026-08-17)
Atualizado em: 2026-08-17
Issue: #2
Intenção: docs/plans/ops51-db-neon-para-homeserver.md
Appetite restante: herdado (~1–2 dias; este impl cabe em 1 sessão + gates)

## Leitura da intenção

- **Outcome:** o banco de produção (dados reais: contatos, assinaturas, apoiadores, campanha) vive no Postgres do homeserver, lido pelo container de produção, com smoke completo (login, WebAuthn, convites, revalidate) e o Neon congelado como rollback.
- **O que NÃO negociar:** PII nunca em disco de máquina de trabalho (dump só no homeserver); nada de dados de produção em bancos dev/test; fail-closed — qualquer passo que falhe deixa o Neon como fonte viva; `teqo_1313` não é tocado por dev/test.
- **O que reavaliar:** a questão em aberto A/B da intenção ("banco de destino: novo `teqo_prod` vs reusar `teqo_1313`", recomendação A) — **validada como B**, ver abaixo.

## Abordagem recomendada

```mermaid
flowchart LR
  NEON[(Neon\nprodução viva)] -->|pg_dump -Fc\nno homeserver| DUMP[(/srv/hdd/backups\nteqo-neon-*.dump)]
  DUMP -->|pg_restore\nteqo_1313 role| LOCAL[(teqo_1313\njá lido pelo container)]
  LOCAL -->|migrate no-op| MIG[(payload_migrations\n56 = 56)]
  LOCAL -->|smoke sem deploy| SMOKE[curl :1313 + revalidate]
  NEON -.congelado.\-> RB[(rollback: re-apontar env)]
```

**Opções consideradas:** A) banco novo dedicado `teqo_prod` + repoint do env | B) reusar o `teqo_1313` preparado (o env já aponta para ele) | C) copiar via dump em máquina de trabalho

**Recomendação: B** — o `teqo_1313` foi criado em 16/08 exatamente para isto (role própria, cadeia completa de 56 migrations aplicadas, **zero conteúdo** — verificado: 0 contatos/posts/supers/etc., só os 435 municípios do seed do remodel), o `teqo-1313.env` do homeserver **já aponta** para `postgres:5432/teqo_1313`, o OPS53 (pipeline de deploy) já trata `teqo_1313` como o banco de produção, e o dump do Neon não tem `OWNER` (restore `--no-owner --no-privileges`, igual ao `db-pull`). Restaurar = a produção "aparece" no container sem nenhuma mudança de config; rollback = Neon intacto (re-apontar env é o plano de reserva, não o caminho).

**Rejeitadas:** A — criaria um segundo banco "de produção" no host, obrigaria repoint do env (novo segredo no `~/stack`), quebraria a suposição do OPS53 e abandonaria a preparação de 16/08; o argumento da intenção ("o teqo_1313 tem vida própria") não se sustenta: o site 1313 É a produção deste repo e o banco está vazio. C — viola o anti-goal (PII em máquina de trabalho); o `db-pull` já provou o padrão "dump feito dentro de container no host".

### Componentes / mudanças

- **`docs/plans/ops51-db-neon-para-homeserver.md`**: status `registrado` → `concluído` + nota do desfecho (A/B resolvido como B).
- **`docs/plans/ops51-db-neon-para-homeserver-impl.md`**: este arquivo.
- **`docs/changelog/2026-08-17-ops51.md`** + `pnpm changelog:build` + `pnpm changelog:check` (OPS44).
- **`AGENTS.md`** (linha do contexto de produção): "The production database still lives on Neon until OPS51" → banco de produção agora vive no homeserver (`teqo_1313`, container `teqo-1313`); Neon congelado como rollback até o cutover; guardas de dev/test inalteradas.
- **`scripts/db-pull.mjs`**: help text deixa de citar `neon.tech` como exemplo obrigatório (cosmético; `PROD_DATABASE_URL` passa a apontar para o homeserver).
- **`~/stack/.env` (homeserver, fora do repo)**: entrada `NEON_DATABASE_URL` (chmod 600) para o dump — input do humano, ver Fase 1.
- **`~/Code/infra-solla/STATE.md` (fora do repo)**: atualização do estado do banco após a migração (anotado no changelog; commit feito à parte ou pelo humano).
- **Migration:** nenhuma (nenhuma mudança de schema; operação de dados).
- **Access / Consent:** nenhuma mudança; os consents, sessions e credenciais WebAuthn restauram como estão no Neon (RP ID não muda — mesmo domínio servido pelo container).
- **UI:** N/A.

## Fases verificáveis

1. **Input + pré-flight + dump (gate humano):** humano insere a URL do Neon em `~/stack/.env` do homeserver (`NEON_DATABASE_URL`, chmod 600). No homeserver: `SELECT version()` do Neon (major ≤ 17), contagem de tabelas/linhas por tabela de conteúdo (linha de base para o compare), dump `pg_dump -Fc --no-owner --no-privileges` → `/srv/hdd/backups/teqo-neon-pre-migracao-<ts>.dump` com sha256 e tamanho registrados. Snapshot de segurança do `teqo_1313` vazio (schema) no mesmo diretório. **Nada sai do homeserver.**
2. **Restore + verificação:** `DROP SCHEMA public CASCADE` no `teqo_1313` → `pg_restore` rodado como a role `teqo_1313` (credencial do `teqo-1313.env`) → comparação de contagens por tabela de conteúdo (Neon × teqo_1313), sanidade de sequences (`nextval > max(id)` nas tabelas-chave), índices/constraints. `payload migrate` contra o `teqo_1313` (serviço de maintenance `teqo-1313-migrate`): esperado no-op (56 = 56); se houver drift, aplica e registra.
3. **Smoke sem deploy (o container já lê o `teqo_1313`):** no homeserver, curl em `127.0.0.1:1313`: `/` 200 com listagem de posts (antes vazia), `/campanha/login` 200, `POST /api/revalidate` com o secret de prod 200, endpoint anônimo de WebAuthn (registration options) 200; humano faz o smoke de browser (login `/campanha`, convite, biometria) em `jorgesolla1313.com.br`.
4. **Rollback + entrega no repo:** runbook de rollback documentado (Neon intacto; caminho de volta = re-apontar `DATABASE_URL` do `teqo-1313.env` para o Neon + `docker compose up -d teqo-1313`); atualizações de docs acima; `pnpm gate:fast`; changelog; PR Ready → auto-merge em `main`.

## Rabbit holes / Não escopo (engenharia)

- Replicação contínua / zero-downtime (cortado na intenção — dump + janela basta).
- Unificar com outro banco do host (Forgejo/Immich) — destinos distintos.
- Migração da media Vercel Blob → Garage (OPS52).
- Cutover de DNS/hospedagem de `pt.jorgesolla.com.br` (infra §7.5–7.6).
- Qualquer mudança de schema/migration nova.

## Riscos e mitigação

- **URL do Neon não está em nenhum env local/homeserver** (verificado) — o humano fornece o input na Fase 1; sem URL, fail-closed: não há dump, Neon segue vivo.
- **Major do Postgres do Neon ≠ 17:** pré-flight na Fase 1; `pg_dump` do container `postgres:17-alpine` lê servidor ≥ seu major anterior; target é 17 — compatível com Neon 15/16/17. Se Neon estiver à frente (improvável em 2026), para e decide com o humano.
- **Ownership/privileges pós-restore:** restore com a role `teqo_1313` (dona do DB) evita `ALTER OWNER` em massa; `--no-owner` para não trazer a role do Neon. Verificação de privilégio na Fase 2.
- **Migrations fora de sincronia:** baseline verificado (56 aplicadas no `teqo_1313` == 56 no `src/migrations/index.ts`, mesma cauda `20260811_234822_add_state_deputy_ballot_name`); mesmo assim o passo migrate da Fase 2 é obrigatório no runbook.
- **Cache ISR do container:** após o restore, `POST /api/revalidate` (já no smoke) busta `posts`/globals.
- **Imagem deployada (21b3c00d) vs main:** mesma cadeia de migrations; `main` só ganhou CI/planos depois — sem drift de schema.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (dados em casa, smoke, rollback, fail-closed)
- [x] Invariantes AGENTS/engineering-standards (nenhum toque em dev/test; PII só no homeserver; guardas intactos)
- [ ] Testes de domínio previstos: nenhum novo — operação; gates do repo rodados na Fase 4
