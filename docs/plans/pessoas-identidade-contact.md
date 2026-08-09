# Identidade: toda pessoa da campanha tem uma ficha Contact

Status: rascunho
Atualizado em: 2026-08-09
Issue: #494
Priority: P1
Model: composer-2.5
Impeccable: A — sem superfície nova; campo no admin + fluxo de criação de staff
Canvas UI: N/A — sem UI
Appetite: ~1–1,5 dia eng; uma migration aditiva
Responsável: —

## Intenção

O staff da campanha (coordenador, assessor, candidato) vive em `campaignUser` com nome, e-mail e celular **duplicados** e sem vínculo com `Contact` — a mesma pessoa física pode existir como assessor, liderança e dobradinha em fichas separadas e sem ligação entre si. A lista unificada de pessoas (C100) precisa do vínculo para mostrar a mesma pessoa uma vez só. Dobradinhas já apontam para `Contact` obrigatoriamente (B163); o gap é o usuário do app. E a liderança ainda não tem **assessores responsáveis** — o vínculo entre pessoas que a coluna Assessorado da C100 mostra (dobradinhas já têm, em `stateDeputy.advisors`).

## Persona e fluxo

- **Persona / contexto:** coordenação e equipe que administram pessoas e contas de acesso; a C100 é a consumidora direta do vínculo.
- **Job principal:** toda pessoa com papel na campanha aponta para UMA ficha `Contact`; papéis múltiplos = a mesma ficha.
- **Fluxo desejado:** ao criar/editar um usuário do app (admin ou criação inline de assessor), a ficha `Contact` é criada ou vinculada — sem pedir nome/e-mail/celular duas vezes; o vínculo é visível e editável no admin. A C100 passa a ler a pessoa pela ficha.
- **Anti-goals de produto:** não vira segundo cadastro de pessoa; não muda login, senha, sessão, passkeys, invites nem notificações; não mexe no consentimento de lideranças/apoiadores.

## Objetivo e aceite

- `campaignUser` ganha vínculo com `Contact` (1:1, opcional no dado — obrigatório no fluxo de criação de staff: cria ou vincula ficha).
- Liderança ganha campo de **assessores responsáveis** (hasMany staff, mesmo padrão de `stateDeputy.advisors`) — habilita a coluna Assessorado da C100.
- Sem mudança de auth: login por e-mail/celular, token, sessão, WebAuthn, convite e notificação funcionam como hoje.
- Dedupe: staff vinculado à mesma ficha de uma liderança/dobradinha aparece UMA vez na C100.
- Guardrails de produto: leader lockdown intacto; consentimentos (liderança/apoiador) intactos; `leadership.user` ("Acesso ao app") permanece.

## Dados (intenção)

Dados: N/A — sem métrica; habilita o dedupe da C100 (um vínculo, não um número).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/CampaignUser.ts` (campo de vínculo), `src/collections/Leadership.ts` (assessores responsáveis, mesmo padrão de `stateDeputy.advisors`), `src/utilities/campaignAccess.ts` (acesso aos campos), fluxos de criação de usuário do app (admin e popover de assessores B154), precedente de dedupe em `src/utilities/contactPhoneInvariant.ts`.
- **Precedente a olhar:** B163 (dobradinha com `contact` obrigatório + backfill) e B154 (criação inline de assessor).
- **Risco de acoplamento:** `campaignUser` é collection de auth — qualquer hook novo roda sobre o documento de sessão; o executor deve respeitar o padrão `afterRead`/`beforeChange` existente e nunca expor campos privados de auth.

## Dependências

Nenhuma. Pré-requisito da C100.

## Fora de escopo

- Dedupe/reconciliação de `Contact` duplicados no dado histórico (mesma pessoa física em duas fichas) — aceito e visível na C100; reconciliação segue pós-eleição junto da multi-tenancy.
- Remover `leadership.user`; renomear `contact` → person; entidade `campaign` (multi-tenancy) — pós-eleição.
- Tocar `stateDeputy` — já vinculado (B163).

## Rabbit holes de produto

- **Vincular staff existente por heurística nome+telefone no backfill.** Erros de dedupe silenciosos e difíceis de desfazer. **Corte:** vínculo por decisão explícita (criação/edição); reconciliação em massa fica para o pós-eleição.
- **"Já que está mexendo, deduplica tudo".** Explosão de escopo e risco em janela eleitoral. **Corte:** só o vínculo novo.

## Questões em aberto (produto)

- **Reconciliação do staff já existente:** link manual por demanda vs varredura nome+telefone agora? **Recomendação:** manual/por demanda; varredura junto da reconciliação geral de Contacts pós-eleição. _(assumido — validar no gate)_
- **Assessores responsáveis da liderança:** hasMany (padrão de `stateDeputy.advisors`) vs um único responsável? **Recomendação:** hasMany — consistente com a dobradinha e com `activity.advisors`. _(assumido — validar no gate)_

## Referências

- [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100, consumidora)
- B154 (criar assessor inline), B163 (dobradinhas com contato), `docs/plans/simplificar-modelo-lideranca.md` (histórico: unificação rejeitada em fatia — esta entrega é o caminho por vínculos)
- `AGENTS.md` — convenção Contact (pessoa normalizada + joins), auth `campaignUser` isolada
