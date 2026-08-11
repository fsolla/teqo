# Pessoas — edição onde você vê (edit-where-you-see) na lista desktop

Status: rascunho
Atualizado em: 2026-08-11
Issue: #655
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em tela existente (`/campanha/pessoas`, tabela desktop); sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c116-ui-draft.canvas.tsx
Appetite: ~1,5–2 dias eng; um outcome verificável — a linha da lista é editável sem sair da tabela
Responsável: —

## Intenção

A mesa corrige dados de pessoas o dia inteiro (telefone errado, município que saiu da rede, assessor que mudou) e hoje precisa abrir a ficha, o detalhe ou o admin para cada ajuste — mesmo quando a correção é uma célula da lista. O pedido: na tabela desktop de `/campanha/pessoas`, toda célula (exceto a coluna Ações) vira um editor in-place — clicou, editou, salvou. Quem lidera/é aliada em várias cidades ainda precisa enxergar o recorte por território sem perder a capacidade de ajustar cidade a cidade.

## Persona e fluxo

- **Persona / contexto:** coordenador e assessores na mesa (staff), trabalhando a lista de pessoas com a base nominal real.
- **Job principal:** corrigir o dado de uma pessoa — um campo de texto ou um vínculo territorial — sem sair da linha em que está.
- **Paradigma da superfície (travado com o humano 2026-08-11):** a célula **é** um input permanente. Sem estado de "edição" com label, borda ou fundo diferente: a célula parece texto e se comporta como input. **Chips são internos ao input** (tags dentro do box, transparente como o resto).
- **Fluxo desejado:**
  - Células de texto (Contato, E-mail, Base): input sempre, sem destaque; salva no blur ou Enter (Esc descarta). Vazio mostra placeholder discreto ("—" atual vira placeholder apagado).
  - Nome: input sempre cujo valor é estilizado como **link** para a página da pessoa; navegação convive com a edição sem trocar de estado (mecanismo em "Questões em aberto").
  - Células de municípios (Assessora, Lidera, Aliada em) e Assessorado: input com **chips internos** — municípios agrupados em chip de território quando a pessoa tem **todos** os municípios do território ("Sertão do São Francisco (5)"), as 19 zonas de Salvador num chip "Salvador (19)"; excedente "+X" expande.
  - Digitar + autocomplete: selecionar uma sugestão **ou** teclar espaço/Enter com o texto batendo (match) no catálogo vira chip imediatamente. Sem match, não vira chip.
  - Clicar num chip de território expande as cidades dele dentro do input; ao sair da célula com o mouse, se a pessoa ainda tiver todas as cidades do território, colapsa de novo.
  - Hover num chip mostra o **X** no canto; clicar no X (não no chip) apaga a cidade daquela linha.
  - Hover nos botões de Ações mostra a **label** da ação em tooltip.
- **Anti-goals de produto:** não vira planilha/data-grid (sem edição em lote, sem seleção múltipla); não é segundo cadastro de pessoa (a ficha continua `Contact`); mobile não muda; "Assessorado" não ganha autocomplete de criar pessoa (só vínculo); nada é criado fora do catálogo (texto sem match não vira chip).

## Objetivo e aceite

- Toda célula da tabela desktop é um **input permanente sem destaque** (sem label de edição, sem borda, sem fundo diferente) — o conteúdo parece texto e edita no lugar; salva no blur/Enter (Esc descarta), escrevendo no campo dono da ficha `Contact` (nome, telefone, e-mail, cidade) — sem migration.
- O Nome mantém o valor como **link** para a página de detalhe da pessoa (quando existir), com a edição convivendo no mesmo input.
- As colunas de municípios (Assessora, Lidera, Aliada em) e Assessorado usam **chips internos ao input** com colapso por território: grupo completo → chip "Território (N)"; 19 zonas de Salvador completas → chip "Salvador (19)"; excedente → "+X" que expande.
- Digitar e selecionar no autocomplete — ou teclar espaço/Enter com o texto batendo no catálogo — transforma o valor em chip; texto sem match não vira chip.
- Remover uma cidade pelo X do chip persiste no servidor; expansão/recolapso por hover não altera dados.
- Hover nas ações mostra a label (WhatsApp, Convidar, Apagar) em tooltip.
- Guardrails: foco por teclado mantém indicador discreto (acessibilidade) mesmo sem caixa de edição; escopo preservado (assessor só edita a carteira dele; leader fora da rota); nenhuma coluna nova; mobile intacto.

## Dados (intenção)

- **Vou apresentar dados?** Não — as colunas expressam vínculos (território/município), não métricas. O chip de território mostra contagem de cidades do grupo, não é dado analítico.
- **Decisões desbloqueadas:** nenhuma leitura decisória nova; a superfície muda de "ler e navegar" para "ler e corrigir".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` (colunas + `PeopleMunicipalityCell`); `src/components/campaign/people/` (filters/chrome); componentes compartilhados já existentes — `CampaignInlineEditableCell` (B163: célula de texto com clique→input→blur/Enter, já suporta `href` no Nome com edição por clique fora do valor), `RelationChipCell` (B157/B159/B169: chips de relação com X no hover, input de autocomplete inline; hoje colapsa por linhas "Ver mais…" — o colapso **por território** com expandir/recolapsar por hover é o trabalho novo), `useCampaignCellAutosave`; escrita via as rotas/actions de célula já usadas pelas listas vizinhas.
- **Precedente a olhar:** [editar-campos-lista-dobradinhas.md](editar-campos-lista-dobradinhas.md) (B163 — mesmo padrão de célula de texto), [generalizar-colunas-relacao-municipios.md](generalizar-colunas-relacao-municipios.md) e [chips-municipios-lista-dobradinhas.md](chips-municipios-lista-dobradinhas.md) (B159/B157 — chips de relação), [estabilizar-lista-dobradinhas-followup.md](estabilizar-lista-dobradinhas-followup.md) (B170 — contrato de colapso de chips), `src/lib/municipalityCatalog.ts` (TI por município, `region`; zonas de Salvador como grupo próprio).
- **Risco de acoplamento:** leader lockdown e escopo do assessor (rota staff; a escrita deve respeitar o access da coleção dona — ex. carteira de outro assessor); **B155+ (#368, in-progress)** migra o padrão de escrita de célula de form action para rota — se entrar antes, seguir o padrão novo; **C112 (#626, in-progress)** muda o shape de telefone (múltiplos) — o editor de Contato deve conviver com a transição.

## Dependências

- **C99/C100** (prontas — ficha `Contact` e lista unificada).
- **Suaves:** C112 (telefones múltiplos — editor de Contato acompanha o shape), B155+ (padrão de escrita de célula), C117 (mesma tabela; sem dependência de ordem entre elas), **C118** (detalhe de pessoa — quando entrar, o link do Nome aponta para ela).

## Fora de escopo

- Mobile (cards): os fluxos próprios já existem; este item é a tabela desktop.
- Edição em lote / spreadsheet mode / reorder de colunas.
- Página de detalhe de pessoa (customizada por capacidades) → **C118** ([pessoas-detalhe-por-capacidades.md](pessoas-detalhe-por-capacidades.md)); este item usa o detalhe existente (liderança) para o link do Nome.
- Ordenação e filtros de ausência na lista → **C117** ([pessoas-ordenacao-filtros-ausencia.md](pessoas-ordenacao-filtros-ausencia.md)).
- Criar pessoa nova na lista (cadastro segue nas rotas atuais).

## Rabbit holes de produto

- **"Já que editamos, vamos editar tudo em lote."** Seleção múltipla, "aplicar a todos", CSV de volta — explode para spreadsheet mode. **Corte neste item:** uma célula por vez, autosave por célula (padrão B163), nada de lote.
- **"Chips internos ao input = contenteditable de verdade."** `contenteditable` com formatação livre, colar HTML, estado de cursor imprevisível — vira um editor de texto. **Corte:** a implementação deve manter o comportamento de input (valor simples, chips como dados, teclado previsível), mesmo que o mecanismo seja um wrapper com chips + input; o executor decide a mecânica.
- **"Expansão de território com animações e estado global."** Guardar qual célula está expandida, coordenar entre linhas, animar transições — vira motor de UI. **Corte:** expansão é local à célula, dirigida por hover/foco, sem estado persistido.
- **Colapso por território querendo virar tree-view.** Chip de território com sub-chips aninhados persistentes (acordeão) é outra interação. **Corte:** grupo colapsa/expande in loco; cidades do grupo aparecem como os chips normais (removíveis), nada de hierarquia persistente.
- **Editar "Assessorado" exigindo criar assessor.** O autocomplete da coluna inversa só vincula pessoas existentes (staff). **Corte:** sem "Criar…" aqui; criação de conta/staff fica nas rotas atuais.

## Questões em aberto (produto)

Resolvidas no gate 2026-08-11:

- **Link do Nome:** `/campanha/liderancas/[id]` quando a pessoa é liderança (sem link senão); a **página de detalhe de pessoa** (customizada por capacidades) entra como Issue própria **C118** ([pessoas-detalhe-por-capacidades.md](pessoas-detalhe-por-capacidades.md)) — quando existir, o link do Nome passa a apontar para ela.
- **Assessorado editável:** sim — autocomplete de assessores existentes (escreve nos vínculos de assessor da liderança/dobradinha; sem "Criar…" aqui).
- **Paradigma:** células são **inputs permanentes sem destaque**; chips internos ao input; nome mantém o valor como link.
- **Navegação do Nome (mecanismo travado com o humano):** o valor é **exibido como link**; cada tecla digitada no input atualiza o texto do link de acordo com o valor (draft), **mantendo o valor real do input em vazio** — o draft vive no display; clique no link navega; salva no blur/Enter. A mecânica exata de sobreposição/display é do plano de implementação, com o requisito de link clicável + digitação no mesmo lugar.
- **Sem match no catálogo:** ao teclar Enter/espaço sem o texto bater em município/assessor, o texto **permanece** no input (não vira chip); nada é criado fora do catálogo.

Ainda em aberto (uma rodada no gate):

- **Quem pode editar a carteira de um assessor ("Assessora")?** **Recomendação:** manter a regra de acesso da coleção dona (coordenação/candidato; assessor só a própria) — sem alargar permissão na lista. _(assumido — validar no gate)_
- **Ordenação do excedente e do autocomplete:** manter a ordem do catálogo (alfabética pt-BR) e sugerir apenas municípios ainda não vinculados. **Recomendação:** sim — mesma regra dos chips das outras listas. _(assumido — validar no craft)_

## Referências

- `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` — tabela, colunas, `PeopleMunicipalityCell` (chips atuais "+2")
- `src/components/campaign/shared/CampaignInlineEditableCell.tsx` — célula de texto B163 (clique→input→blur/Enter, `href` no Nome)
- `src/components/campaign/shared/RelationChipCell.tsx` — chips de relação B157/B169 (X no hover, input inline, colapso por linhas)
- `src/components/campaign/shared/CampaignCellEditOverlay.tsx` / `useCampaignCellAutosave.ts` — overlay e autosave de célula
- `src/utilities/people/peopleData.ts` — view model (`assessoraMunicipalityIDs`, `leadershipMunicipalityIDs`, `deputyMunicipalityIDs`, …)
- `src/lib/municipalityCatalog.ts` — TI por município (`region`), zonas de Salvador (grupo próprio de 19)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c116-ui-draft.canvas.tsx`
