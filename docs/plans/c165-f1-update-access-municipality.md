# C165-F1 — Activity: update access fecha município nulo/fora da carteira (bypass REST)

Status: rascunho
Atualizado em: 2026-09-15
Issue: (registrada junto do PR do C165)
Pai: #1010 (C165) — `depends: [1010]`
Priority: P2
Kind: defect
Appetite: ~0,25 dia eng (sem UI, sem migration)
Responsável: —

> Débito registrado na triage do `/simplify` do C165
> ([c165-importar-eventos-google-impl.md](c165-importar-eventos-google-impl.md)).

## Contexto

O C165 tornou `municipality` opcional na `Activity` e decidiu (Decisão G do impl plan) que o
guard de **valor** do município vive na server action: advisor não cria sem município, não
limpa (`null`) e não reaponta para fora da carteira — cada caso com mensagem nomeada
(`ACTIVITY_UNSCOPED_ADVISOR_MESSAGE` / `ACTIVITY_OUT_OF_SCOPE_MESSAGE`).

O access cobre a **linha** (`canUpdateActivity` devolve um `Where` que alcança a atividade),
não o **valor**: uma escrita que passe direto pelo Local API/REST com credencial de campanha
(ex.: `PATCH /api/activity/:id` com o JWT no header `Authorization`, caminho já declarado no
threat model de `src/utilities/access/shared.ts`) consegue gravar `municipality: null` ou um
id fora da carteira. Na prática o comportamento é simétrico ao lado `create` (que já valida
`data`), e o cookie `campaign-token` é path-scoped `/campanha` — o caminho exigiria JWT
copiado à mão; ainda assim é o eixo de access e fecha por construção.

## Evidência

- `src/utilities/access/activities.ts` — `canCreateActivity` é `data`-aware (C165);
  `canUpdateActivity` devolve `Where`/`boolean` sem inspecionar `data.municipality`.
- `src/app/(campaign)/campanha/actions/activity.ts` — guard equivalente no `updateActivityRecord`
  (mensagens nomeadas) cobre o caminho da UI.
- `src/utilities/access/shared.ts:100-104` — caminho REST/GraphQL com JWT de campanha no threat model.

## Objetivo e aceite

- `canUpdateActivity`, para advisor (staff não-unrestricted), inspeciona `data.municipality`
  quando presente: `null` → `false`; número fora do write scope → `false`; ausente → o `Where`
  de linha atual (nada muda para quem só edita outros campos).
- Coordenador/candidato/admin intocados; `editing: 'tudo'` continua alcançando qualquer
  atividade **com** município, mas limpar para `null` segue coordenação/candidato-only.
- A action mantém o guard/UX (Decisão G do C165) — defesa em profundidade, sem mensagem nova.
- Pin int com `overrideAccess: false` e um advisor (`campaignActivity.int.spec.ts`): limpar
  município e reapontar para fora da carteira são recusados pelo access; editar outro campo
  da mesma atividade continua funcionando.

## Fora de escopo

- Field access por **valor** para `municipality` (Payload field access recebe o valor, não o
  documento; a assimetria é do próprio modelo — o guard na collection access é o dono).
- Hardening equivalente nas demais collections (decisão sistêmica separada; cada domínio tem
  seu dono e seu precedente).
- Mudança de UX/copy/mensagens da action.

## Riscos

- Advisor com `editing: 'tudo'` que hoje limpa município pela action: já era recusado
  (C165) — o access só antecipa a mesma recusa em outros caminhos.
- Leitura do perfil fresco no access update (mesmo `getFreshCampaignUser` já usado) mantém
  o custo por request dentro do padrão do módulo.

## Aceite de engenharia

- [ ] `pnpm gate:fast` verde; int pinado em `tests/int/campaignActivity.int.spec.ts`.
- [ ] Sem migration, sem Consent, sem UI; URL/slug intactos.
