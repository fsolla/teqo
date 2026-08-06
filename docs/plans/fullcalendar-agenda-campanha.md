# C15 — FullCalendar em `/campanha/agenda`

Status: blocked (plano ainda não em main)
Atualizado em: 2026-08-06
Issue: #390
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: D — superfície nova: agenda semanal/mensal no lugar da grade de cards como vista primária
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c15-ui-draft.canvas.tsx`
Appetite: ~1,5–2 dias eng; um outcome verificável — staff opera a semana em calendário em Teqo
Responsável: —

## Intenção

Com o modelo enxuto (C14), a maior alavanca de adoção é **ver e mexer o tempo como no Google Calendar**, dentro de Teqo — sem sync ainda. FullCalendar (MIT: week/month/list + interaction) na rota `/campanha/agenda`, com filtros que a mesa já entende (município, deputado presente, tags) — os mesmos filtros que a C16 transforma em link de import.

## Persona e fluxo

- **Persona / contexto:** coordenador na semana do candidato; assessor no recorte de municípios; quem só precisa *ver* usa filtros (ex.: deputado presente).
- **Job principal:** enxergar a semana filtrada, criar no slot, abrir compromisso; remarcar presença do deputado só se for coordenador/candidato.
- **Fluxo desejado:** Agenda → semana → aplica filtros (tags / município / deputado presente) → cria no vazio / abre evento / arrasta (se permitido) → detalhe operacional quando precisar.
- **Anti-goals de produto:** N calendários tipo Google Resources; sync nesta fatia; assessor remarcar agenda do deputado.

### Esboço de fluxo (D)

```text
[/campanha/agenda] → filtros → semana → criar / abrir / arrastar (se permitido)
```

## Objetivo e aceite

- Staff abre `/campanha/agenda`: vista **semana** default; mês e lista disponíveis.
- Filtros de produto: pelo menos **município**, **deputado presente**, **tags** (e combinação). A vista reflete o filtro ativo.
- Slot vazio → criar com horário pré-preenchido (fluxo C14); município obrigatório.
- Clique no evento → detalhe/painel; drag/resize só quando o ator pode editar aquele compromisso (presença do deputado = só coordenador/candidato).
- Nav “Agenda” → `/campanha/agenda`; rotas antigas de atividades não quebram o hábito (redirect/equivalência — implementação).
- Leader lockdown; sem Google/link de import nesta fatia (C16).

## Dados (intenção)

- **Vou apresentar dados?** Não analítico — calendário operacional.
- **Decisões desbloqueadas:** “o que cabe nesta semana (neste filtro)?” / “posso remarcar?”
- **Forma:** FullCalendar; escopo de leitura do ator.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `…/agenda`, componentes de activity/agenda, nav, actions de horário com gate de `deputyPresent`.
- **Precedente a olhar:** `/campanha/atividades`, E13 giros, B138; FullCalendar React MIT plugins.
- **Risco de acoplamento:** client bundle; access; filtros reutilizáveis pela C16.

## Dependências

- Dura: **C14**.

## Fora de escopo

- Link de import / sync Google → **C16** (consome os mesmos filtros).
- Premium resources, recorrência, papéis novos.
- Redesign do compositor de giros.

## Rabbit holes de produto

- **“Sync já.”** **Corte:** C16.
- **“Resources por assessor.”** **Corte:** filtros.
- **“Assessor arrasta evento do deputado.”** **Corte:** política C14.

## Questões em aberto (produto)

- **Calendário vs lista:** **Opções:** A) calendário default + lista modo | B) só calendário. **Recomendação:** **A**. _(assumido — validar)_
- **Filtros persistidos na URL?** **Opções:** A) sim (compartilhável / base do link C16) | B) só estado local. **Recomendação:** **A** — alinha com “link de import do filtro” na C16. _(assumido — validar)_

## Decisões travadas (gate)

- Remarcar `deputyPresent`: só coordenador/candidato.
- Filtros de agenda incluem município, deputado presente, tags (insumo da C16).

## Referências

- GitHub Issue [#390](https://github.com/fsolla/teqo/issues/390)
- Canvas UI (gate): [`plan-c15-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c15-ui-draft.canvas.tsx)
- Plano C14 · https://fullcalendar.io · C3/C13/E13
