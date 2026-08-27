# Atividade: marcar evento como público (base para exposição no site)

Status: rascunho
Atualizado em: 2026-08-27
Issue: #936
Priority: P3
Model: composer-2.5
Serializes: #933 (C148)
Impeccable: B — encaixe no modal de atividade
Rascunho UI: docs/plans/c151-atividade-evento-publico-ui-draft.html
Appetite: ~0,5 dia eng; um outcome verificável — o staff marca/desmarca "Evento público" e a marcação é durável e consultável, sem mudar nada no comportamento atual das telas
Responsável: —

## Intenção

"Let's add a new property to activities to register it as a public event. Public events will later be exposed in the candidate's website to be shareable for followers/supporters." — hoje uma atividade (caminhada, comício, agenda do mandato) é só registro interno: quando o time quiser divulgar um evento no site, não há como distinguir o que é público do que é operação interna. Este item adiciona essa distinção — uma marcação simples, durável e consultável — para que a futura agenda pública do site tenha um dado confiável de onde partir. A exposição em si é outro item (PUB): aqui só se marca a intenção.

## Persona e fluxo

- **Persona / contexto:** staff de campanha (coordenador/assessor/candidato) editando atividades em `/campanha/atividades`, no escritório ou em campo; liderança não entra nesta história.
- **Job principal:** ao cadastrar/editar uma atividade, marcar se ela é um evento público — sem planilha paralela nem precisar lembrar disso depois.
- **Fluxo desejado:** abrir o modal da atividade → marcar/desmarcar "Evento público" (desmarcado por padrão) → salvar; a marcação persiste e volta correta ao reabrir. Nenhuma tela muda de comportamento.
- **Anti-goals de produto:** página pública ou share kit agora; segundo cadastro de "evento" paralelo à atividade; filtro/badge nova na lista; flag alterando o espelho do Google ou o access atual.

### Esboço de fluxo (B/C/D)

```text
[início: modal de atividade] → staff marca "Evento público" (default: desmarcado)
→ salvar → [outcome: marcação durável e consultável; nenhuma tela muda de comportamento]
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/c151-atividade-evento-publico-ui-draft.html` — cenas desktop + mobile (~390px) do modal com o novo checkbox ao lado dos existentes.

## Objetivo e aceite

- O staff que edita atividades marca/desmarca "Evento público"; a marcação persiste entre sessões, volta correta ao reabrir a atividade e fica consultável para o consumidor futuro — sem nenhum comportamento novo visível nas telas.
- **Guardrails de produto:** a flag marca INTENÇÃO de exposição; a exposição é FUTURA (item PUB posterior). Nada no site público muda; nada na agenda muda de comportamento.
- **Guardrail para o FUTURO consumidor:** atividade pública nunca expõe lideranças, tarefas, resultados nem dados operacionais internos — a superfície pública futura mostra o "cartaz do evento" (título, data/hora, município/local, descrição), nunca o backend operacional.
- Quem marca é o mesmo staff que edita atividades (coordenador/assessor/candidato); liderança segue em lockdown e não vê o campo nem nada novo.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma superfície de dados neste item; a flag é insumo durável para o item PUB futuro (agenda pública, PUB3 #45, blocked).
- **Decisões desbloqueadas:** staff + escolha de quais atividades são candidatas a exposição pública; o item PUB futuro decide o quê/como expor.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto acima (cartaz do evento, nunca backend operacional).

## Dados da decisão (literais)

- Rótulo de UI (checkbox): "Evento público" — default desmarcado.
- Descrição admin pt-BR (curta): "Quando marcado, este evento poderá ser publicado no site do candidato (futuro)."
- Quem pode marcar: os mesmos papéis que editam atividades hoje (coordinator/advisor/candidate); liderança não vê o campo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** collection `activity` (`src/collections/Activity.ts`), modal central `src/components/campaign/activity/` (ActivityOverlay — create+edit), detalhe `/campanha/atividades/[slug]`; Payload admin herda.
- **Precedente a olhar:** checkboxes no mesmo arquivo — `deputyPresent` (~L493) e `allDay` (~L508), ambos checkbox com default desmarcado, indexado e descrição admin; migrations recentes de campo simples (`20260819_213947_add_site_settings_facebook_pixel_id`, `20260823_161905_add_municipality_update_deliberation`) + regeneração de tipos.
- **Risco de acoplamento:** `SYNC_RELEVANT_ACTIVITY_FIELDS` (`googleCalendarSync.ts:100`) decide se campo dispara re-sync — recomendação v1: NÃO incluir (calendário oficial segue full-staff). Access atual (`canReadActivity` inclui leader) NÃO muda; flag de negócio nova não pede field-access especial.

## Dependências

- **Serializa com C148** (mesmo modal de atividade — não trabalhar em paralelo).
- PUB3 (#45) — consumidor futuro da flag (agenda pública); está blocked e NÃO é desbloqueado por este item (aqui não se constrói exposição).
- C114 (espelho do Google) — interação a respeitar: decisão v1 = flag não influencia o sync.

## Fora de escopo

- Página/agenda pública no site e share kit — item PUB futuro (PUB3 #45); nada no `(frontend)` muda.
- Qualquer consumo/exposição da flag agora (site, feed, filtro, badge na lista).
- Collection nova ou modelagem paralela de "evento público" — a marcação vive na atividade existente.
- Mudança de access/visibilidade (liderança continua sem ver nada novo; Payload admin segue como está).
- Integração da flag com o espelho do Google (decisão v1: não influencia).
- Marcação em lote de atividades existentes (spreadsheet mode — sem pedido).

## Rabbit holes de produto

- **"Já deixar a página pública pronta."** Se alguém "só completar": agenda pública, SEO, share kit — explosão de escopo. **Corte neste item:** só a marcação; exposição é item PUB futuro.
- **"Aproveitar e ligar a flag ao espelho do Google."** Se alguém "só completar": re-escopo do calendário oficial (full-staff) e conflito com C114. **Corte neste item:** sync intocado em v1.
- **"Criar collection 'evento público' separada."** Se alguém "só completar": segundo cadastro de atividade, dados divergentes. **Corte neste item:** flag na atividade existente.
- **"Filtrar/badgear a lista por eventos públicos."** Se alguém "só completar": redesign de tabs/filtros da agenda. **Corte neste item:** nenhuma tela muda de comportamento.

## Questões em aberto (produto)

- **Em qual seção do modal entra o checkbox?** **Opções:** A) junto dos outros checkboxes do modal (seção básica/agendamento) | B) seção própria "Publicação" | C) campo avançado/oculto. **Recomendação:** A — um checkbox a mais não pede seção nova; o rascunho o mostra ao lado dos existentes. _(assumido — validar no gate com o rascunho)_
- **A flag influencia o espelho do Google?** **Opções:** A) NÃO em v1 — calendário oficial continua full-staff; a flag existe para o site futuro | B) sim, re-scope do sync. **Recomendação:** A — mudar o sync agora complica C114 sem ganho de produto hoje. _(recomendação — validar com produto)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c151-atividade-evento-publico-ui-draft.html`
- `src/collections/Activity.ts` (precedentes `deputyPresent`/`allDay`) · `src/components/campaign/activity/ActivityOverlay.tsx`
- `src/utilities/access/activities.ts` · `src/utilities/googleCalendarSync.ts:100` · `src/collections/Post.ts:78` (precedente público mais próximo: `Post.type` valor `evento`)
- `AGENTS-campaign.md` — seção "Campaign activities (C3)" · PUB3 (#45)
