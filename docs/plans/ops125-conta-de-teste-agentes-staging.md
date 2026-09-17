# Conta de teste dos agentes no ambiente de staging

Status: rascunho
Atualizado em: 2026-09-17
Issue: #1126
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável — o agente de `work-issue` consegue fazer login em staging e exercer a feature que acabou de entregar.
Responsável: —

## Intenção

O fluxo `work-issue` passou a fechar com uma verificação funcional em staging (OPS121): depois do merge, o agente abre `https://staging.jorgesolla1313.com.br` e testa só a funcionalidade entregue. Na prática o agente trava na porta: ele tenta as credenciais do seed mínimo (`pnpm db:seed:minimal`) e elas não existem no staging, porque o banco de staging não é alimentado por esse seed. Resultado: o passo de verificação que devia pegar defeito real vira beco sem saída, e o loop merge→verificação não fecha.

Este item cria **uma conta de teste dedicada e sintética no ambiente de staging**, com credenciais que o agente consegue usar no momento do teste, para que o passo do OPS121 seja executável — sem dar ao agente acesso ao `DATABASE_URL` de staging/produção e sem criar um segundo mecanismo de autenticação.

**Premissa corrigida no gate (2026-09-17):** o banco de staging é uma **cópia do banco de produção** — e não o seed sintético que `docs/AGENT-OPS.md:10` e `docs/ops/teqo-1313-deploy.md:191` afirmam. Isso torna o item um **assunto de PII/LGPD**: a conta é sintética e o acesso existe só para verificar a entrega, mas qualquer credencial de staging deixa de poder ser commitada e o agente não pode exportar/registrar dado real.

## Persona e fluxo

- **Persona / contexto:** agente executor (`work-issue`) na máquina do humano, logo após o merge, com o browser apontando para staging; humano presente mas não pilotando.
- **Job principal:** entrar em staging e exercer a feature recém-entregue para confirmar que ela funciona no ambiente real.
- **Fluxo desejado:** merge verde → aguardar o run de staging → abrir `/campanha/login` → entrar com a conta de teste documentada → testar a feature → registrar o desfecho (ou abrir Issue do defeito).
- **Anti-goals de produto:** não é automação de login/e2e contra staging (fora de escopo no OPS103); não é segundo fluxo de autenticação; não é conta por feature/papel; não dá ao agente o banco de staging/produção nem `ALLOW_REMOTE_DB`.

## Objetivo e aceite

- Existe uma **conta de teste sintética e exclusiva de staging** que o agente usa no passo do OPS121.
- A conta é criada/atualizada de forma **idempotente e restrita a staging** — nunca roda contra produção nem contra o banco local.
- O agente **não recebe** `DATABASE_URL` de staging/produção nem `ALLOW_REMOTE_DB`; o acesso é só pela aplicação (login).
- A credencial **não é commitada** (staging tem PII real): vive no ambiente do homeserver e é fornecida/liberada no momento do teste, pelo caminho documentado no passo de verificação; nunca vira segredo do GitHub nem entra no env do agente por padrão.
- **Guardrails de PII/LGPD:** a conta acessa a aplicação, nunca o banco; o agente **não exporta, grava ou cola em Issue/PR** dado real visto em staging (só o desfecho do teste); a criação da conta não toca dados de terceiros nem altera os dados copiados.

## Dados (intenção)

- **Vou apresentar dados?** Não — é item de operação/credencial; nenhum número ou agregado é exibido.
- **Decisões desbloqueadas:** o agente decide se a feature entregue passou na verificação em staging; a coordenação decide se staging pode receber uma conta de teste e com que papel.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: sem dashboard de acesso, sem auditoria de login nova.

## Dados da decisão (literais)

- **ID reservado:** OPS125; kind **chore**; prio **P2**; slug `ops125-conta-de-teste-agentes-staging`; sem UI (Impeccable A).
- **Ambiente-alvo:** `https://staging.jorgesolla1313.com.br` (noindex); container `teqo-staging`; DB `teqo_staging` (**cópia da produção, com PII real** — confirmado no gate); porta `127.0.0.1:1314`; bucket `teqo-media-staging`. Tela de login: `/campanha/login`.
- **Tipo de identidade:** `campaignUser` (auth de campanha; login por email), **não** `users` do admin — o fluxo de teste em `/campanha` usa a sessão `campaign-token`.
- **Papel assumido:** `coordinator` ("Coordenador Geral") — unrestricted, único caminho para o agente alcançar qualquer feature staff que o OPS121 precise testar (`candidate` é o equivalente; `advisor`/`communicator`/`leader` são escopados e bloqueariam a maioria dos testes). O preço é ver dados reais; mitigado pela credencial não-commitada e pela regra de não-exportar. _(assumido — validar com produto; ver questão de papel abaixo)_
- **Identidade assumida:** nome `Agente de Teste (staging)`, email `agente-teste@teqo.invalid` (mesmo espaço `.invalid` do seed sintético). _(assumido — validar com produto)_
- **Credencial:** sintética e **não commitada**; vive no ambiente do homeserver (junto do `~/stack/teqo-staging.env`, que nunca vira GitHub secret) e é liberada ao agente no run pelo humano. _(assumido — o mecanismo exato é do plano de implementação)_
- **Proibido como literal:** `DATABASE_URL` de staging/produção, `ALLOW_REMOTE_DB=true`, segredo de staging como GitHub secret, senha de staging em arquivo versionado.
- **Precedente de criação:** `scripts/seed-minimal.mjs` + `scripts/lib/seed-minimal-manifest.mjs` (upsert idempotente por email/username, `.invalid`, senha sintética) — referência de forma, **não** reusar o script (ele é local-only por guard e pina dados que colidiriam com a cópia real).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/CampaignUser.ts` (roles/auth), `src/app/(campaign)/campanha/actions/auth.ts` + `login/` (login por email), `scripts/seed-minimal.mjs`/`scripts/lib/seed-minimal-manifest.mjs` (precedente), `.agents/skills/work-issue/execution-pipeline.md` (§Verificação pós-deploy staging) e `docs/ops/teqo-1313-deploy.md` (bootstrap de staging).
- **Precedente a olhar:** OPS121 (#1079, passo de verificação pós-deploy) e OPS103 (`docs/plans/ops103-staging-homeserver.md`) — donos do staging e dos seus limites; `scripts/assert-local-database.mjs` e `scripts/lib/cli.mjs` (`requiresWriteConfirm`) — donos dos guards de escrita.
- **Risco de acoplamento:** não transformar isto em mudança do povoamento de staging (decisão do OPS103); não regredir os guards de banco; não acoplar o passo OPS121 a um segredo que o agente não alcança.

## Dependências

- OPS121 (#1079) — o passo de verificação em staging que precisa do login (dono do contexto).
- OPS103 (staging no homeserver) — dono do banco/ambiente; este item só adiciona a conta.
- Nenhuma dura.

## Fora de escopo

- Mudar a origem dos dados de staging (cópia de prod vs seed sintético) — decisão do OPS103, não deste item.
- Corrigir nos docs a afirmação de que staging é sintético (`docs/AGENT-OPS.md:10`, `docs/ops/teqo-1313-deploy.md:191`, `docs/plans/ops103-staging-homeserver.md:52`): destino OPS103 (dono do ambiente), não este lote de conta de teste.
- Conta por papel (advisor/leader/communicator) ou por feature; e2e automatizado de login contra staging.
- Qualquer escrita em produção, no admin (`users`) ou em dados de terceiros.

## Rabbit holes de produto

- **"Já que vamos mexer, roda o seed mínimo inteiro no staging."** Se alguém "só completar": pina municípios/objetos/Consent e pode colidir com os dados reais de staging. **Corte neste item:** só a conta de teste.
- **"Cria uma conta para cada papel."** Se alguém "só completar": N credenciais para manter e documentar. **Corte neste item:** uma conta `coordinator`; papéis específicos só com evidência.
- **"Deixa o agente conectar direto no banco de staging para criar a conta."** Se alguém "só completar": viola o guardrail "agente nunca recebe `DATABASE_URL` de staging/prod". **Corte neste item:** criação por bootstrap no homeserver; o agente só faz login.

## Questões em aberto (produto)

- **De onde vêm os dados de staging?** **Resolvido no gate (2026-09-17):** **cópia do DB de produção, com PII real** — os docs commitados (`docs/AGENT-OPS.md:10`; `docs/ops/teqo-1313-deploy.md:191`; `docs/plans/ops103-staging-homeserver.md:52`) estão desatualizados e a correção deles tem destino (ver Fora de escopo). Consequência travada: credencial **não** commitada; regra de não-exportar PII; criação da conta só por bootstrap no homeserver.
- **Com que papel?** **Opções:** A) `coordinator` (unrestricted; alcança qualquer feature, mas vê dado real) | B) `candidate` (unrestricted, equivalente para acesso) | C) papel escopado por feature. **Recomendação:** A nesta fatia — C bloquearia a maioria dos testes e exigiria uma conta por item; B não muda a exposição. Se produto exigir menor exposição, C vira item próprio com a lista de features. _(assumido — validar com produto)_
- **Quando a credencial é liberada?** **Opções:** A) o humano fornece no run de verificação (OPS121) | B) o agente lê de um arquivo gitignored do worktree provisionado. **Recomendação:** A — nenhum segredo de staging passa a existir no env do agente por padrão; B só se o atrito do passo manual justificar.
- **Quem cria a conta?** **Opções:** A) script idempotente de bootstrap no homeserver, restrito a staging por guard | B) criação manual de admin. **Recomendação:** A — repetível e auditável; manual não sobrevive a recriação do banco.

## Referências

- GitHub Issue: #1126
- Design UI (gate): N/A — sem UI
- Planos irmãos: [`ops121-verificacao-pos-deploy-staging-work-issue.md`](ops121-verificacao-pos-deploy-staging-work-issue.md) (OPS121/#1079), [`ops103-staging-homeserver.md`](ops103-staging-homeserver.md) (OPS103)
- Arquivos-chave (pista, não contrato): `src/collections/CampaignUser.ts`, `src/app/(campaign)/campanha/actions/auth.ts`, `src/app/(campaign)/campanha/login/`, `scripts/seed-minimal.mjs`, `scripts/lib/seed-minimal-manifest.mjs`, `.agents/skills/work-issue/execution-pipeline.md`, `docs/ops/teqo-1313-deploy.md`, `docs/AGENT-OPS.md`
- Testes a olhar: `tests/unit/seedMinimalManifest.unit.spec.ts`, `tests/int/campaignAuth.int.spec.ts` (se existir), `tests/e2e/campaignE2EFixtures.ts`
- `AGENTS.md` / `AGENTS-campaign.md` (auth de campanha) / `AGENTS-infra.md` (staging/deploy) / `docs/AGENT-OPS.md` (tabela de ambientes)

## Self-score (shaping)

4/5 — (1) fatia = um outcome verificável (o agente loga em staging e testa a entrega); (2) appetite de ~0,5 dia comporta a conta + o caminho de credencial; (3) persona, job e aceite em linguagem de produto; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia — mecanismo de criação, papel e guarda ficam para o plano de implementação. Ressalva: staging tem PII real (confirmado no gate), então a credencial não é commitada e a regra de não-exportar é guardrail de aceite, não detalhe.
