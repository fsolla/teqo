# C97 — Agenda: seletor de dia + horário (shadcn) no popover de criação rápida

Status: rascunho
Atualizado em: 2026-08-09
Issue: #482
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe nos campos Início/Término do popover/drawer de criação rápida (C91)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-10/canvases/plan-c97-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

No popover (e no bottom sheet mobile) de criação rápida da agenda, os campos "Início" e "Término" usam o seletor nativo `datetime-local`, que na prática só permite escolher o dia — o horário não é selecionável/confiável, ficando preso ao valor do slot clicado. Quem precisa marcar um compromisso às 14h30 ou com término às 15h45 é obrigado a abrir "Mais detalhes" (formulário completo), quebrando justamente o fluxo rápido do Google-Calendar-like (C91).

Vamos trocar esse controle por um seletor shadcn de data **e** horário (calendário + passos de hora), para que dia e horário sejam escolhidos de forma confiável dentro do popover.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor de campanha criando compromisso direto no calendário de `/campanha/agenda`, em mesa (desktop, popover) ou no celular no campo (bottom sheet).
- **Job principal:** lançar um compromisso com dia **e** horário corretos sem sair da agenda e sem abrir o formulário completo.
- **Fluxo desejado:**
  1. Clique num slot da semana/dia (ou num dia do mês) → overlay abre com título vazio e horários preenchidos do slot.
  2. Ajusta Início (e Término) escolhendo dia no calendário e hora nos passos disponíveis — os dois editáveis.
  3. Salva → overlay fecha, compromisso aparece na agenda, sem navegação.
- **Anti-goals de produto:** o popover não vira o formulário completo; o prefill do slot clicado não é removido; "Mais detalhes" continua existindo; nada de compromisso "all-day" (todo compromisso tem hora).

### Esboço de fluxo (B)

```text
[clique no slot/dia] → [overlay com Início/Término no seletor novo, prefill do slot]
  → [ajusta dia no calendário e/ou hora nos passos] → [Salvar]
  → [overlay fecha; evento na agenda sem reload]
```

## Objetivo e aceite

- No popover de criação rápida (e no bottom sheet mobile), Início e Término usam o seletor shadcn de data+horário; é possível escolher o dia **e** o horário, com passos de hora visíveis e selecionáveis.
- O prefill continua vindo do slot clicado (semana/dia = slot de 30 min; mês = 09:00–10:00), agora ajustável.
- Salvar grava o horário efetivamente escolhido; as validações atuais seguem valendo (Início obrigatório; Término posterior ao Início).
- O fuso America/Bahia continua sendo o usado para exibir e gravar (mesmo comportamento dos helpers atuais).
- O fluxo pós-salvar não muda: overlay fecha, agenda recarrega a janela visível, sem navegação.
- Comportamento no desktop e no mobile preservado (popover ancorado / bottom sheet).

## Dados (intenção)

- **Vou apresentar dados?** Não — é controle de entrada, sem métrica ou visualização nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/activity/ActivityInlineCreate.tsx` — campos Início/Término do overlay (C91).
  - `src/components/ui/` — novo seletor (ou conjunto calendário+hora) no padrão shadcn do projeto (o repo é style `radix-nova`; o link de referência do humano aponta para a doc do Calendar/Date&Time Picker da shadcn).
  - `src/lib/campaignTime.ts` — helpers de parse/format em America/Bahia, que devem continuar sendo a fronteira de fuso.
- **Precedente a olhar:** plano `docs/plans/agenda-criar-evento-inline.md` (C91) — o overlay atual; os testes e2e do fluxo de criação rápida na agenda.
- **Risco de acoplamento:** os mesmos inputs `datetime-local` também existem no formulário completo (`ActivityForm.tsx`) e nas tarefas (`ActivityTaskFields.tsx`) — fora do escopo deste item; se o seletor for compartilhável sem custo, o executor pode apontar isso no plano de implementação, mas não é obrigação.

## Dependências

- Nenhuma dura. Precedente: C91 (done — o overlay que este item refina). Sem sobreposição com C93 (link de import) nem C95 (seletor de modo de visualização).

## Fora de escopo

- Trocar o seletor no formulário completo `/campanha/atividades/nova` e nas tarefas — follow-up se o componente compartilhado tornar barato (registrar).
- Edição inline de compromisso existente, recorrência, seleção de intervalo (range) no calendário.
- Compromissos "all-day" ou sem hora.
- Restrição de horário à janela visual da agenda (07:00–22:00) — a grade é visual, o modelo aceita qualquer hora.

## Rabbit holes de produto

- **Sincronizar Término com Início automaticamente (deslocar fim quando o início muda).** Se alguém "só completar", vira regra de comportamento invisível. **Corte neste item:** Término mantém o prefill do slot; quem quiser ajusta na hora.
- **Picker de range no calendário.** Tentação de fazer Início+Término num único calendário com arrasto. **Corte:** dois campos independentes, como hoje.
- **Nova dependência pesada / i18n extra do calendário.** **Corte:** usar o componente shadcn do padrão do projeto (o executor decide a instalação mínima no plano de implementação).

## Questões em aberto (produto)

- **Passo do seletor de hora?** **Opções:** 5 min | 15 min | 30 min (grade da agenda). **Recomendação:** 15 min — a grade da agenda é 30 min, mas compromissos fora do múltiplo (ex.: 09:45) são comuns no campo; 15 min cobre isso sem virar planilha. _(assumido — validar)_
- **Trocar também o formulário completo e as tarefas, se o seletor for compartilhável?** **Opções:** só o popover | popover + formulário completo se barato. **Recomendação:** só o popover neste item (fatia mínima verificável); uniformização vira follow-up registrado. _(assumido — validar)_

## Referências

- GitHub Issue: #482
- Canvas UI (gate): /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-10/canvases/plan-c97-ui-draft.canvas.tsx
- Arquivos para o executor abrir primeiro: `src/components/campaign/activity/ActivityInlineCreate.tsx`, `src/utilities/activityUi.ts` (`activitySlotPrefill`), `src/lib/campaignTime.ts`, `docs/plans/agenda-criar-evento-inline.md`
- Doc shadcn referida pelo humano: https://ui.shadcn.com/docs/components/base/calendar (Date and Time Picker)
