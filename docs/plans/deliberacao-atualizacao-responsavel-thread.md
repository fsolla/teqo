# C88 — Deliberação na atualização (responsável, thread, resolvido)

Status: blocked (plano local; promove após merge em main)
Atualizado em: 2026-08-06
Issue: #397
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — fluxo novo de deliberação em cima do feed de atualizações
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c88-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável (coordenação atribui, discute e fecha uma atualização)
Responsável: —

## Intenção

Com a atualização virando o lugar único do “o que aconteceu” (**C87**), a coordenação precisa **deliberar ali mesmo**: apontar um responsável, conversar na própria atualização e marcar resolvido — sem abrir demanda, atividade ou Zap paralelo para cada fato.

## Persona e fluxo

- **Persona / contexto:** Alex (coordenador/candidato) vendo um registro Ruim/Urgente no município; Casey (assessor) recebendo a bola e respondendo no fio.
- **Job principal:** transformar um fato registrado em ação acompanhada — quem resolve, o que se falou, e se fechou.
- **Fluxo desejado:** abre a atualização no feed/detalhe → (coordenação) escolhe responsável → as partes comentam no fio → alguém marca Resolvido → a atualização deixa de gritar como aberta.
- **Anti-goals de produto:** virar tracker estilo Jira; segundo cadastro de pessoa; chat em tempo real; misturar com Demandas/Atividades como substituto; liderança participando do fio staff; editar o texto original da atualização via comentários.

### Esboço de fluxo (C)

```text
[feed da atualização]
  → card com texto + polaridade (+ urgente)
  → Responsável: [selecionar staff]
  → Thread: comentários em ordem
  → Ação: Marcar resolvido / Reabrir (se preciso)
```

## Objetivo e aceite

- Staff com poder de deliberação pode atribuir **um responsável** (usuário de campanha staff) a uma atualização.
- Na própria atualização existe **fio de discussão** (comentários em sequência) visível para quem já lê atualizações daquele município.
- Existe ação explícita **Resolvido** (e caminho claro para reabrir, se o gate confirmar).
- Atualização resolvida permanece legível no histórico; o estado aberto/resolvido é óbvio no card.
- Leader lockdown: liderança **não** vê nem participa deste fio.
- Depende do modelo unificado de **C87** (sem reintroduzir kinds/tipos de sinal).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item (lista/filtro opcional de “abertas com responsável”, se couber no appetite — senão só no card).
- **Decisões desbloqueadas:**
  - Coordenação: “quem resolve este fato?”
  - Responsável: “o que falta / o que já fiz?” (no fio)
  - Coordenação: “podemos dar por encerrado?”
- **Forma:** *adiada* — sem dashboard de tickets; restrição: não inventar KPI estadual a partir do fio.

## Direção no codebase (hipótese)

- **Áreas prováveis:** domínio de `municipalityUpdate` (detalhe/feed/form), actions de campanha do município, padrão de feed de atualizações de **atividade** (comentário append-only), notificações se já houver gancho de criação.
- **Precedente a olhar:** `Activity` updates feed + append; C87 plano irmão; imutabilidade do corpo da atualização (C12).
- **Risco de acoplamento:** access por município (assessor só no portfólio); não criar “pessoa” fora de `campaignUser`/`Contact`; serialização de migrations com outros itens C.

## Dependências

- **Dura:** **C87** (modelo unificado de atualização).
- Suave: notificações push/in-app para o responsável (pode ficar fora se estourar appetite — ver questões).

## Fora de escopo

- Unificar com Demandas ou Atividades.
- Mentions @, anexos, rich text, reações.
- SLA, filas kanban, prioridade além do Urgente já em C87.
- Participação de liderança / apoiador no fio.
- Editar ou apagar o texto original da atualização (correção = nova atualização ou comentário no fio).

## Rabbit holes de produto

- **"Vira um ticket tracker."** Labels, epics, board. **Corte:** só responsável + fio + resolvido no card da atualização.
- **"Comentário edita o fato."** Mistura histórico. **Corte:** corpo da atualização imutável; fio é aparte.
- **"Qualquer um atribui."** **Corte no gate:** quem pode atribuir / resolver (recomendação abaixo).
- **"Notifica WhatsApp."** Canal externo. **Corte:** no máximo notificação interna já existente; Zap fora.

## Questões em aberto (produto)

- **Quem pode atribuir responsável e marcar resolvido?** **Opções:** A) só coordinator/candidate; B) qualquer staff que já pode criar atualização naquele município; C) autor + unrestricted. **Recomendação:** A para atribuir/resolver; B pode comentar. _(assumido)_
- **Responsável pode ser qualquer staff ou só assessores do município?** **Opções:** A) staff do município (advisors + unrestricted); B) qualquer campaignUser staff. **Recomendação:** A — evita atribuir a quem não vê o território. _(assumido)_
- **Reabrir depois de resolvido?** **Opções:** A) sim, ação explícita; B) não — nova atualização. **Recomendação:** A — deliberação real precisa de reabrir. _(assumido)_
- **Notificar o responsável ao atribuir / ao comentar?** **Opções:** A) sim, via canal interno já existente; B) só badge no produto nesta fatia. **Recomendação:** A se o gancho for barato; senão B e item sucessor. _(assumido B nesta fatia se o appetite apertar)_
- **Atualização sem responsável ainda pode ter fio e resolvido?** **Opções:** A) sim (resolvido = “já tratamos o fato”); B) responsável obrigatório para resolver. **Recomendação:** A — nem todo fato precisa de dono. _(assumido)_

## Referências

- GitHub Issue: [#397](https://github.com/fsolla/teqo/issues/397)
- Canvas UI (gate): [/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c88-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-hin1/canvases/plan-c88-ui-draft.canvas.tsx)
- Depende: [atualizacao-unificada-polaridade-urgente.md](atualizacao-unificada-polaridade-urgente.md) (C87)
- Precedente de feed: atualizações em Atividade; feed atual de município
