# C123 — Agenda: modal central como única superfície de criação/edição de atividade

Status: rascunho
Atualizado em: 2026-08-11
Issue: #667
Priority: P1
Model: composer-2.5
Impeccable: C — fluxo de criação/edição inline redesenhado na agenda (popover → modal central; formulário completo some)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c123-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável
Responsável: —

## Intenção

A criação/edição de compromisso hoje pede **dois passos**: o popover de criação inline (estilo Google Calendar, C91) e depois o link "Mais detalhes" para preencher o resto no formulário completo — que vive em páginas próprias (`/campanha/atividades/nova` e `/campanha/atividades/[slug]/editar`). A mesa quer **uma** superfície só: o overlay da agenda (modal central no desktop, drawer no mobile) com **todas as configurações** — criação E edição ali mesmo, sem páginas de formulário. O popover atual também acumulou defeitos visíveis: o campo "Local" aparece **duplicado** na mesma tela (mesmo input renderizado duas vezes), e o seletor de dia/hora (calendário + seletores de hora/minuto empilhados) exige **rolar** dentro do popover para encontrar o seletor de horário — que fica escondido abaixo do calendário e ninguém descobre.

## Persona e fluxo

- **Persona / contexto:** staff na mesa (coordenador/assessor) no `/campanha/agenda`, criando ou ajustando um compromisso no slot certo do calendário — à pressa, entre uma ligação e outra.
- **Job principal:** lançar o compromisso completo no calendário **sem sair da agenda e sem navegar** para outra página.
- **Fluxo desejado (criar):** clica num slot → overlay abre já com o dia/hora do slot → preenche **todas** as configurações ali mesmo → Salvar → overlay fecha, evento aparece na agenda, sem reload.
- **Fluxo desejado (editar):** clica num evento da agenda → overlay abre com os valores do compromisso → ajusta → Salvar → evento atualizado no calendário. O detalhe `/campanha/atividades/[slug]` continua existindo, alcançável por link no próprio overlay (e o botão "Editar" do detalhe abre o mesmo overlay).
- **Anti-goals de produto:** não vira planilha nem redesenho do calendário em si; a página de detalhe `/campanha/atividades/[slug]` permanece como leitura/registro de resultado (não é formulário completo); recorrência não entra.

### Esboço de fluxo (C/D)

```text
[criar: clique no slot | editar: clique no evento]
→ [modal central (desktop) / drawer (mobile) com TODAS as configurações, dados pré-preenchidos]
→ [Início: data + hora separados | Término: data + hora separados]
→ [Salvar] → [overlay fecha, refetch da janela, calendário atualizado]
```

## Objetivo e aceite

- Clicar num slot abre um **modal central** (desktop), não mais um popover ancorado ao ponto de clique.
- O overlay expõe **todas as configurações** do compromisso — todas as seções do formulário completo de hoje (básicas, data e horário, onde, pessoas e organizações, tarefas, demandas).
- Clicar num evento abre o **overlay de edição** (mesmo modal/drawer, valores preenchidos) — o clique não navega mais para o detalhe; o detalhe fica acessível por link no overlay.
- **As páginas `/campanha/atividades/nova` e `/campanha/atividades/[slug]/editar` saem sem redirecionamento** — o overlay vira a única superfície de criação/edição (o "Mais detalhes" morre junto); links antigos para essas rotas dão 404.
- O campo **"Local" aparece uma única vez** no overlay (remover o bloco duplicado).
- Início e Término têm **dois seletores separados**: um só de **data** e um só de **horário**, ambos visíveis **sem rolar** — nada de horário escondido abaixo do calendário.
- **Mobile:** continua o bottom sheet (C103) — mesma superfície única de criação/edição — com **duas linhas empilhadas** (Início em cima, Término embaixo), cada uma com o seletor de **dia** e o seletor de **hora lado a lado na mesma linha**: `[dia de início][hora de início]` / `[dia de término][hora de término]`.
- Salvar não navega; refetch da janela visível.
- Guardrails existentes intactos: contrato civil `YYYY-MM-DDTHH:mm` de parse/validação, validação início ≤ término, modo "Todo o dia" (só data), prefill do slot, permissões staff, título imutável na edição.

## Dados (intenção)

- **Vou apresentar dados?** Não — são campos de entrada de data/hora, sem decisão de apresentação.
- **Decisões desbloqueadas:** nenhuma de dados; forma fica para o plano de implementação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/ActivityInlineCreate.tsx` (vira o overlay único de criar/editar — popover vira modal; remover o bloco duplicado de Local — hoje dois `<Field>` idênticos; "Mais detalhes"/`buildActivityCreateHref` morrem), `src/components/campaign/activity/ActivityDateTimeField.tsx` (dividir o picker em seletor de data + seletor de hora — provavelmente dois controles lado a lado mantendo o contrato civil), `ActivityForm.tsx` (conteúdo do overlay — a forma em página morre), páginas `/campanha/atividades/nova` e `/[slug]/editar` (remover junto com `formActions`/prefill correspondentes; a página de detalhe segue e seu botão de editar passa a abrir o overlay), `src/utilities/activityUi.ts` (href de prefill), `src/app/(campaign)/campanha/actions/activity.ts` (ações de criar/editar se unificam no overlay).
- **Precedente a olhar:** plans C91 (`agenda-criar-evento-inline.md`), C103 (`agenda-mobile-form-criacao-usavel.md`), C97 (seletor de dia/hora shadcn), C104 (todo o dia); testes `tests/unit/activityInlineCreate.unit.spec.tsx` e `tests/e2e/campaignActivity.e2e.spec.ts` usam "Mais detalhes" e as páginas de formulário — serão atualizados pelo executor.
- **Risco de acoplamento:** leader lockdown não toca criação/edição staff (o toggle de tarefa no detalhe segue como está); o contrato de valor civil `YYYY-MM-DDTHH:mm` é compartilhado com a validação do submit e com o modo todo-o-dia — não quebrar; o detalhe perde o botão de editar em página — ele passa a abrir o overlay; e2e das rotas removidas morrem junto (sem redirecionamento — 404).

## Dependências

- **C124** (tarefas sem prazo): **dura** — o overlay inclui a seção de tarefas e deve nascer já com o modelo simplificado.

## Fora de escopo

- Redesenho da página de detalhe `/campanha/atividades/[slug]` (leitura/registro de resultado permanece como está).
- Recorrência; mudanças no FullCalendar ou nos filtros/feed iCal; drag-and-drop de remarcação (intocado).

## Rabbit holes de produto

- **"Overlay vira mini-CRM".** Se alguém "só completar" o desejo de ter tudo no overlay, ele vira o formulário completo empilhado sem hierarquia. **Corte:** seções agrupadas como no formulário atual, overlay rolável internamente com rodapé fixo (Cancelar/Salvar).
- **"Unificar com o sheet mobile".** O bottom sheet (C103) é o padrão mobile aceito; não redesenhar o mobile além dos seletores divididos. **Corte:** mobile = mesmo conteúdo, mesma anatomia de sheet.

## Questões em aberto (produto)

- **Como a edição é acessada?** **Opções:** A) clique no evento abre o overlay de edição (estilo Google Calendar), e o botão "Editar" do detalhe abre o mesmo overlay; B) só o botão "Editar" do detalhe abre o overlay; C) clique no evento abre o overlay e o detalhe vira acessível por link no próprio overlay. **Recomendação:** A. _(decidido no gate — clique no evento abre o overlay de edição; o detalhe continua alcançável por link no próprio overlay; o botão "Editar" do detalhe abre o mesmo overlay)_
- **Rotas `/campanha/atividades/nova` e `/[slug]/editar`:** redirecionar ou 404? **Recomendação:** redirecionar. _(decidido no gate — remover sem redirecionar, 404 para links antigos)_

## Referências

- GitHub Issue #667 (C123)
- Plans C91 (`agenda-criar-evento-inline.md`), C103, C104, C105, C124 (dependência)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c123-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityInlineCreate.tsx` · `ActivityDateTimeField.tsx` · `ActivityForm.tsx` · `ActivityTaskFields.tsx`
- `src/app/(campaign)/campanha/atividades/nova/page.tsx` · `[slug]/editar/page.tsx` · `[slug]/page.tsx`
- `tests/unit/activityInlineCreate.unit.spec.tsx` · `tests/e2e/campaignActivity.e2e.spec.ts`
