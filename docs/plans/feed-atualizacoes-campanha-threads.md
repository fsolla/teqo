# C89 — Feed da campanha de atualizações (cada update = thread)

Status: ready
Atualizado em: 2026-08-06
Issue: #401
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: D — superfície nova: feed campanha-wide + interação por fio
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-c89-ui-draft.canvas.tsx`
Appetite: ~1,5–2 dias eng; um outcome verificável — staff acompanha e discute o que aconteceu na carteira num só lugar
Responsável: —

## Intenção

A mesa precisa de um **feed da campanha** — não só o histórico dentro de um município — para ver o que está acontecendo, comentar e deliberar. Cada **atualização** vira um **fio (thread)**: o fato registrado é o post; a conversa (e, com C88, responsável / resolvido) vive ali. O slot **Atualizações** da barra mobile (**B164**) aponta para esta superfície; desktop também a alcança pela nav.

## Persona e fluxo

- **Persona / contexto:** coordenador varrendo a carteira no celular ou na mesa; assessor no recorte dos municípios que administra; pressão entre campo e WhatsApp.
- **Job principal:** ver o que aconteceu recentemente, entrar no fio de uma atualização, participar da discussão (e fechar quando couber).
- **Fluxo desejado:**
  1. Abre **Atualizações** (barra mobile ou nav) → feed cronológico das atualizações da **carteira do ator** (assessor = só seus municípios; unrestricted = amplo).
  2. Cada card = uma atualização (texto, polaridade/urgente quando C87 existir, município, idade).
  3. Toca o card → o update abre como **thread**: corpo imutável do fato + comentários em sequência (+ responsável / resolvido quando **C88** estiver disponível).
  4. Comenta / atribui / marca resolvido conforme o poder do papel (regras de C88); volta ao feed.
- **Anti-goals de produto:** segundo tracker estilo Jira; chat em tempo real; feed público / liderança; misturar Demandas/Atividades; spreadsheet de KPIs; twin do modelo de atualização fora de C87/C88.

### Esboço de fluxo (D)

```text
[Atualizações]
  → feed (carteira)
  → toca update
  → thread: fato + comentários (+ responsável / resolvido)
  → volta ao feed
```

## Objetivo e aceite

- Existe destino de produto **Atualizações** (rota de feed) usável por staff no escopo da carteira.
- Feed lista atualizações recentes com identidade do município e sinal de estado do fio (ex.: aberta / resolvida — quando C88 existir).
- Abrir um item mostra a atualização como **thread** interativa (comentar no fio); o corpo do fato permanece o registro original (imutável na intenção — alinhado a C88).
- Deliberação (responsável, resolvido, reabrir) **reusa** a intenção de **C88** — não inventa um segundo protocolo de ticket neste item.
- Leader lockdown: liderança **não** vê o feed nem os fios staff.
- Slot da barra **B164** e entrada de nav apontam para este destino (quando ambos existirem).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item (feed operacional, não KPI estadual).
- **Decisões desbloqueadas:**
  - Coordenação/assessor: “o que aconteceu na carteira desde ontem?”
  - No fio: “o que falta / quem resolve / podemos fechar?” (com C88)
- **Forma:** adiada — restrição: leitura relativa à carteira do ator; sem % estadual absoluto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `/campanha/atualizacoes` (ou equivalente), componentes de feed/thread no domínio de atualização de município, nav (`nav.ts` + slot B164), loaders no escopo do ator; actions de comentário/deliberação alinhadas a C88.
- **Precedente a olhar:** feed de atualizações no detalhe do município; C87 / C88; notificações `municipality_update`; B164.
- **Risco de acoplamento:** access por município; não criar pessoa fora de `campaignUser`/`Contact`; serialização com migrations de C87/C88.

## Dependências

- **Dura:** **C87** (modelo unificado de atualização) — o feed consome esse registro.
- **Dura:** **C88** (fio / responsável / resolvido) — a interação completa do thread; sem C88 o feed ainda pode listar e abrir o fato, mas deliberação fica incompleta — preferir shipar C89 **depois** de C88 ou degradar honestamente (só leitura + “comentários em breve”) se o gate pedir paralelismo com B164.
- Soft: **B164** (slot na barra); C15 irrelevante.

## Fora de escopo

- Chrome da barra inferior / página Mais → **B164**.
- Remodel do formulário de registro (polaridade / urgente) → **C87**.
- Definir de novo as regras de quem atribui/resolve → já em **C88** (não reabrir aqui).
- Mentions @, anexos rich, reações, SLA, kanban.
- Participação de liderança/apoiador.
- Sync externo / WhatsApp.

## Rabbit holes de produto

- **"Feed + barra no mesmo item."** Estoura appetite e mistura chrome com domínio. **Corte:** B164 vs C89.
- **"Vira rede social da campanha."** Curtidas, stories. **Corte:** fato + fio de trabalho.
- **"Filtros infinitos / analytics no feed."** **Corte:** cronológico da carteira; filtros só se couberem no appetite (município / abertas) sem virar BI.
- **"Comentário edita o fato."** **Corte:** corpo imutável; fio à parte (C88).

## Questões em aberto (produto)

- Nenhuma pendente — gate 2026-08-06 confirmou o lote com as recomendações:
  1. **Ordem:** C87 → C88 → C89 (feed completo com thread); B164 pode âncora/empty antes.
  2. **Desktop:** item “Atualizações” também na nav staff (mesmo destino).
  3. **Criar no feed:** não nesta fatia — só caminhos existentes (município / wizard).

## Referências

- GitHub Issue: [#401](https://github.com/fsolla/teqo/issues/401)
- Canvas UI (gate): [`plan-c89-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-c89-ui-draft.canvas.tsx)
- Irmão chrome: [barra-navegacao-inferior-mobile.md](barra-navegacao-inferior-mobile.md) (**B164**)
- Depende: C87 [#396](https://github.com/fsolla/teqo/issues/396), C88 [#397](https://github.com/fsolla/teqo/issues/397)
- Planos: [atualizacao-unificada-polaridade-urgente.md](atualizacao-unificada-polaridade-urgente.md), [deliberacao-atualizacao-responsavel-thread.md](deliberacao-atualizacao-responsavel-thread.md)
