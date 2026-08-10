# Municípios mobile: omnibox colado ao header e card mais denso (pós-B193/B184)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #607
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na tela existente `/campanha/municipios` (mobile < md), sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-29/canvases/plan-b196-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um encaixe de densidade/estética em superfície já entregue
Responsável: —

## Intenção

A entrega mobile de `/campanha/municipios` (B184 omnibox + B193 card) está no ar, mas a tela ainda "vaza" e "respira" demais para varredura no campo. Medido no estado atual (390px): a barra de filtro fica 16px abaixo do header e, ao rolar, os cards passam visíveis nesse vão (sticky ancora na borda do padding do scrollport); o campo de busca tem 56px de altura por causa de um botão "X" invisível de 44px + paddings; ao focar surge um anel vermelho de 3px; o nome do município sai em 24px com ~13px de ar até o território; o chip Nível quebra para a segunda linha; e os avatares dos grupos de relação, sem sobreposição, ocupam várias linhas quando há muitos registros. Queremos a lista lendo densa e limpa — mais municípios por tela, sem card atravessando a barra.

## Persona e fluxo

- **Persona / contexto:** coordenador(a) e assessores(as) no celular, no campo ou entre reuniões; varredura rápida da lista para priorizar municípios.
- **Job principal:** enxergar o máximo de municípios de uma vez, com nome/território lendo como um bloco e os sinais (votos, tendência, nível, rede) colados ao registro.
- **Fluxo desejado:** abre a lista → barra de filtro colada ao topo (sem vão) → rola: nada passa por cima da barra → card denso: nome menor com território colado, chips numa linha, avatares em uma linha por grupo → toca qualquer dado e edita no sheet (inalterado).
- **Anti-goals de produto:** não mexer nos edit-where-you-see (sheets) nem no que cada controle edita; não mudar labels/dados dos chips; não tocar o desktop (`md+`); não criar limite de avatares com "…" escondendo gente.

### Esboço de fluxo (B)

```text
[abre /campanha/municipios mobile] → [barra de filtro colada ao header; rola sem card acima dela]
  → [card: nome 18px + território colado · chips classe/tendência/nível com label em cima
     · avatares sobrepostos numa linha por grupo] → [toca dado → sheet de edição (inalterado)]
```

## Objetivo e aceite

- Barra de filtro colada ao header em mobile: sem vão entre elas e nenhum card visível acima da barra durante o scroll. **Vale como padrão de TODAS as listas** (chassis compartilhado — decidido no gate: A).
- Campo de busca sem margem e com o mínimo de padding interno; barra visivelmente mais baixa que hoje (56px de campo → ~40px no total da barra).
- Foco no campo sem anel/contorno vermelho — nenhum destaque de cor no input ativo.
- Nome do município com fonte menor que hoje (24px → ~18px, mantendo hierarquia sobre o território).
- Território colado verticalmente ao nome (vão ~2–4px, sem sobrepor).
- Espaçamento vertical entre os blocos do card reduzido (densificar), incluindo o vão entre a barra de votos estimados e o bloco nome/território — sem encolher a área de toque dos controles.
- Chips de Classe, Tendência e Nível com a label acima do chip (não mais ao lado ou sem label); cada chip lê como bloco label+valor. Aceita-se 1 ou 2 linhas conforme o espaço disponível — o que importa é nenhum chip quebrar no meio (decidido no gate: a tentativa de caber tudo numa linha sem a label Classe já falhou).
- Avatares de Assessores, Lideranças e Dobradinhas numa única linha por grupo: sobreposição dinâmica (mais avatares → mais sobreposição; poucos → menos), sem limite de avatares e sem wrap.

## Dados (intenção)

- **Vou apresentar dados?** Não — sem métrica nova; é densidade e alinhamento da superfície existente.
- **Decisões desbloqueadas:** nenhuma leitura nova de dado. Guardrail: nomes/iniciais dos avatares continuam acessíveis (sr-only) e os chips mantêm os valores atuais.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - Omnibox (chassis compartilhado): `src/components/campaign/shared/CampaignListOmnibox.tsx` (`campaignListOmniboxFormClassName` — sticky no form; campo `min-h-11 … px-2 py-1.5`; botão "Limpar" de `size-11` sempre montado, que infla a altura; `focus-within:ring-3 focus-within:ring-ring/50`) + `src/components/campaign/shell/CampaignQuickActionsHost.tsx` (`CampaignContentScroll` com `p-4`).
  - Card mobile: `src/components/campaign/municipality/MunicipalityMobileCard.tsx` (nome/território, chips com `ChipLabel` inline, grupos de relação) + `src/components/campaign/shared/MunicipalityRelationAvatarStack.tsx` (modo `wrap` do B193 vs `-space-x-2` do desktop).
- **Achado de exploração (gate 2026-08-10):** o sticky da barra ancora na borda do padding-box do scrollport — com o `p-4` do `CampaignContentScroll`, a barra cola 16px abaixo do header e os cards rolam visíveis nesse vão (medido no browser: `formY=72` com header de 56px, stick nunca engaja acima disso). A correção passa por encurtar esse vão no contexto da barra — não necessariamente mudar o padding global do scrollport (outras telas usam a folga).
- **Precedente a olhar:** desktop `MunicipalityList.tsx` (~linha 488, `MunicipalityAdvisorAvatarStack` com `-space-x-2` e cap 3) — o card mobile quer a MESMA sobreposição, mas sem cap; planos pais `docs/plans/municipios-mobile-sem-moldura.md` (B184) e `docs/plans/municipios-card-mobile-edit-where-you-see.md` (B193).
- **Risco de acoplamento:** o omnibox é chassis de TODAS as listas (atividades, lideranças, apoiadores, territórios…) — mudanças na barra afetam as outras listas de uma vez (ver Questões em aberto).

## Dependências

- Nenhuma (sucessor de B184 e B193, já em produção). Soft: manter o padrão visual do desktop intacto.

## Fora de escopo

- Desktop (`md+`) da lista de municípios e das demais listas.
- Comportamento de edição (sheets/edit-where-you-see), ferramentas de busca/sugestões do omnibox.
- Tooltip de avatares do desktop (permanece lá; o card mobile não ganha tooltip).
- Outras superfícies mobile (feed de atualizações, agenda…) — só o que o chassis compartilhado carregar.

## Rabbit holes de produto

- **Mudar o padding do scrollport global.** Se alguém "só consertar" tirando o `p-4` do `CampaignContentScroll`, todas as telas do `/campanha` perdem a folga do topo. **Corte neste item:** resolver o vão no contexto da barra (form/lista), não no shell.
- **Sistema de avatares para o app inteiro.** O pedido é sobre os três grupos de relação do card mobile. **Corte:** só o card; se outras telas pedirem, é outro item.
- **"Aproveitar e polir" a tela.** A lista mobile ainda tem outras arestas (ex. rodapé de atualização). **Corte:** somente os pontos do aceite; o resto vira item separado.

## Questões em aberto (produto)

- **Os ajustes da barra valem para todas as listas?** O omnibox é chassis compartilhado (B184 o entregou como "padrão das listas"). **Decidido no gate (2026-08-10): A — vale para todas** (padrão único; as queixas — vão, anel, campo alto — são do chassis, não da página).
- **O chip de classe (ex. "Reduto 23,5×") acompanha o novo padrão?** **Decidido no gate (2026-08-10): B — ganha label "Classe" acima**, alinhado com Tendência/Nível. Como a fila de chips já ocupa 2 linhas de qualquer forma, o espaço extra fica claro com a label; a tentativa anterior de caber numa linha sem ela não deu certo.

## Referências

- GitHub Issue #607
- Canvas UI (gate): /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-29/canvases/plan-b196-ui-draft.canvas.tsx
- Pais: `docs/plans/municipios-mobile-sem-moldura.md` (B184) · `docs/plans/municipios-card-mobile-edit-where-you-see.md` (B193) · `docs/plans/territorio-perto-nome-lista-municipios.md` (B165, desktop)
- Arquivos a abrir primeiro: `src/components/campaign/shared/CampaignListOmnibox.tsx` · `src/components/campaign/municipality/MunicipalityMobileCard.tsx` · `src/components/campaign/shared/MunicipalityRelationAvatarStack.tsx` · `src/components/campaign/shell/CampaignQuickActionsHost.tsx`
