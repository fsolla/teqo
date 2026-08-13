# C140 — Formulários de campanha apagam o digitado em erro de validação (React 19 form reset)

Status: rascunho
Atualizado em: 2026-08-13
Issue: #740
Priority: P2
Model: composer-2.5
Impeccable: B — UX (perda de dado digitado em erro); sem fluxo novo
Canvas UI: N/A — não muda layout
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

Formulários de campanha com `useActionState` + `<form action={submitAction}>` (padrão
`action={submitAction}`) sofrem o reset automático do React 19: **após QUALQUER action
assentada (sucesso ou erro), campos não controlados voltam ao defaultValue**. Quando o
formulário fica aberto em erro de validação/conflito, o usuário vê o alerta mas **todo o
digitado some** — silenciosamente.

**Provado empiricamente nesta sessão (C139):** create row desktop e sheets mobile de
contatos — mesmo nó DOM, valor restaurado ao default após submit que retornou erro
(validation e conflito de nome). O fix do C139 trocou para campos controlados + dispatch
manual (`preventDefault` + `startTransition(() => submitAction(new FormData(...)))`), que
mantém `isPending` correto sem reentrar no plumbing de form action.

Restam **~21 formulários** com o padrão antigo na árvore campaign
(`grep 'action={submitAction}' src/components/campaign`): votePledge (2), municipality
(wizard steps, updates, advisors), tour, advisor, leadership (3), organization, stateDeputy,
demand (3), shared wizard. Todos com o mesmo defeito de UX em erro.

## Persona e fluxo

- **Persona:** staff da campanha (coordenador/assessor) preenchendo formulários longos
  (liderança, demanda, organização, dobradinha, declaração de votos, wizard de giro).
- **Job principal:** errar um campo, ver o erro, corrigir SÓ o campo errado e salvar.
- **Fluxo desejado:** o erro aparece, os demais campos **permanecem digitados**, o usuário
  corrige o mínimo.
- **Anti-goal:** nenhuma mudança de comportamento de sucesso; nenhuma mudança de schemas
  de dados; não virar epic de refactor global.

## Objetivo e aceite

- Nenhum form com `useActionState` em `/campanha` apaga o digitado quando a action retorna
  erro (fieldErrors ou message).
- O padrão de fix segue o precedente C139: campos controlados **ou** dispatch manual
  (`onSubmit` + `preventDefault` + `startTransition`), decidido por formulário conforme o
  que o C139 já fez (sheets controladas; create row com dispatch manual + uncontrolled).
- Cobertura por spec e2e ou unit do form mais representativo por família (ex.: um form
  longo de criação em erro mantém valores).
- Regressão: os specs existentes das famílias tocadas seguem verdes sem alteração.

## Dados (intenção)

- **Vou apresentar dados?** Não — o "dado" é o comportamento de formulário já provado na
  sessão C139 (mesmo nó, valor resetado, 3 formas distintas).

## Direção no codebase (hipótese)

- **Áreas prováveis:** os ~21 forms listados acima em `src/components/campaign/*`
  (`grep -rn 'action={submitAction}' src/components/campaign`).
- **Precedente a olhar:** `src/components/campaign/contacts/ContactFormFields.tsx`
  (controlado + manual dispatch, comentário documentando o porquê) e
  `ContactCreateRow.tsx` (dispatch manual); `ActivityOverlay.tsx` (controlado + manual —
  precedente anterior ao C139).
- **Risco de acoplamento:** cada form é independente; o fix é mecânico por arquivo.
  Forms com telefones/arrays (`PhonesFieldEditor` FORM mode) precisam conferir se o editor
  interno é controlado (não é resetado pelo dispatch manual).

## Já resolvido no simplify/critique (não reabrir)

- Forms do domínio `contacts` (create row, create/edit sheets) — fix C139 nesta entrega,
  coberto pelo e2e `campaignContacts`.

## Explicitamente fora

- Forms fora de `/campanha` (frontend público) — não verificados nesta colheita; reavaliar
  se o padrão aparecer lá.
- Mudança de comportamento de sucesso ou de schemas — fora de escopo.
- Padronizar TODOS os forms num único helper compartilhado — decisão de engenharia do
  item (pode ficar com os dois padrões C139, ou extrair helper se o lote mostrar DRY).

## Dependências

- `C139 (#728)` — a entrega que provou o defeito e fixou o domínio contacts (via `depends`
  na Issue).
