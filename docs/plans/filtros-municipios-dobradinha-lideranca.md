# Filtrar municípios por Dobradinha e Liderança (+ liberar as colunas ao Assessor)

Status: registrado
Atualizado em: 2026-08-09
Issue: #458
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na omnibox (combobox) e chips de `/campanha/municipios`, e no gate de visibilidade das colunas da lista; sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b176-ui-draft.canvas.tsx
Appetite: ~1,5–2 dias eng; três dimensões de filtro novas + partido + liberação da coluna Dobradinhas ao assessor; sem migration
Responsável: —

## Intenção

A lista de municípios (`/campanha/municipios`) já mostra, em colunas próprias, **quais lideranças atuam em cada município** (B155) e **quais dobradinhas estão fechadas** (B157). Mas nenhuma das duas é **filtrável**: a barra omnibox só conhece Município, Território, Assessor, Assessoria, Tendência, Classe, Nível, Prioridade, Cenário e Ordenação. Para montar um recorte por pessoa vinculada, o staff precisa ler linha a linha — ou abrir a ficha de cada liderança/dobradinha.

O pedido: **poder filtrar a lista por Dobradinha (deputado estadual) e por Liderança** pelo combobox de filtro, exatamente como já se filtra por Assessor — e, no mesmo fôlego, **por partido da dobradinha**. Isso é o "antes" das decisões de alocação: quem vai atrás, onde falta gente nossa, em que município a dobradinha X já está ou está negociando.

O produto decidiu no gate que esses dados de **dobradinha são de todo o staff**, não só coordenador/candidato: a coluna Dobradinhas (e sua edição inline) **passa a ser visível e operável pelo Assessor**, dentro do portfólio que ele administra — sem reabrir o recorte da coluna de Lideranças, que já é staff-wide.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral, Candidato ou Assessor na mesa/celular, varrendo a lista de municípios para montar um recorte de campo sob pressão de tempo.
- **Job principal:** listar "municípios onde a dobradinha X / o partido Y atua" e "municípios onde a liderança Z está", sem sair da barra.
- **Fluxo desejado:**
  1. Foca a omnibox → digita nome/fragmento (ex. "maria").
  2. Vê sugestões agrupadas — agora incluindo **Dobradinha**, **Liderança** e **Partido (dobradinha)** (busca por nome do contato / sigla, como Assessor).
  3. Escolhe → vira chip dentro do input; a lista filtra; pode continuar digitando outro filtro.
  4. Remove um chip com "×" → só aquele filtro some.
  5. Para triagem: escolhe "Sem liderança" / "Sem dobradinha" / "Sem partido" → municípios sem vínculo nessa dimensão.
- **Anti-goals de produto:** criar edobradinha/liderança a partir da barra (continua nas colunas); filtro por estimativa de votos (assimetria); virar planilha; mudar o contrato de recorte já congelado (B18) para os parâmetros existentes — só adicionar.

### Esboço de fluxo (B)

```text
[lista aberta] → foca barra → digita "psd"
  → sugestões: Partido (PSD), Dobradinha (Maria Souza – PSD), Liderança (Maria de Fátima), Sem…
  → escolhe "Partido: PSD" → chip + lista filtrada (municípios com dobradinha do PSD)
  → digita à direita → "Sem liderança" → chip → recorte: com dobradinha do PSD e sem liderança
  → outcome: fila de municípios pronta para recrutamento/negociação
```

## Objetivo e aceite

- No combobox de `/campanha/municipios`, **Dobradinha**, **Liderança** e **Partido (dobradinha)** aparecem como dimensões de filtro (busca por nome/sigla + chip removível), no mesmo padrão de Assessor.
- Escolher uma dobradinha filtra para municípios vinculados a ela; escolher uma liderança filtra para municípios onde ela atua; escolher um partido filtra para municípios cuja(s) dobradinha(s) é(são) daquele partido. Multi-valor (OR) dentro de cada dimensão.
- Recorte **"Sem …"** disponível: municípios **sem liderança**, **sem dobradinha** e **sem partido** (leitura de triagem; espelho de "Sem nível" e do precedente `NO_PARTY_FILTER_VALUE`).
- O recorte vive na mesma URL do resto da lista (parâmetros novos, aditivos); bookmarks/filtros salvos antigos continuam salvos (parâmetros novos ausentes = sem restrição).
- **Visibilidade — decisão do gate (2026-08-09): todo o staff.** Os grupos **Dobradinha**, **Liderança** e **Partido** aparecem para todo staff. **A coluna Dobradinhas deixa de ser coordenação/candidato-only e passa a ser vista e editada (inline) pelo Assessor**, dentro dos municípios que ele administra; a coluna Lideranças já é staff-wide (sem mudança). Assessor só vê/filtra pelos nomes dentro do escopo que administra.
- Liderança (papel `leader`) não alcança esta página (lockdown inalterado).
- Aceita em staff e em mobile (omnibox única para todas as larguras; chips legíveis).

## Dados (intenção)

- **Vou apresentar dados?** Não — qualitativo: recortes por vínculo de pessoa/partido que a lista já mostra.
- **Decisões desbloqueadas:** staff — "em que municípios devo atuar com base em quem já está / falta lá?" sem abrir fichas.
- **Forma:** _adiada ao plano de implementação_ — chips com nome do contato (dobradinha com partido; partido como sigla), iguais aos das colunas; a contagem da seleção é a própria lista.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/utilities/municipality/municipalityListUrl.ts` — estado/parse(canonical)/serialização da lista ganham parâmetros novos (aditivos ao contrato congelado): dobradinha (IDs), liderança (IDs) e partido; `buildMunicipalityListWhere` inclui dobradinha (relação direta, já indexada), partido (via `stateDeputies.party`, facet/leitura cruzada) e liderança (necessita leitura reversa por `leadership.municipalities`, precedente de `loadMunicipalityLeadershipSummaries`).
  - `src/utilities/municipality/municipalityPageData.ts` — `MunicipalityListFilterFacets` ganham IDs de dobradinha, de liderança e a lista de partidos; facets respeitando o mesmo contrato de "valores ainda alcançáveis sob os outros filtros".
  - `src/utilities/municipality/municipalityOmnibox.ts` + `MunicipalityFilters.tsx` — novas sementes/grupos/chips/apply/remove; aliases de palavra ("deputado", "liderança", "lider", "partido", siglas).
  - `src/utilities/municipality/municipalityViewModels.ts` / `src/utilities/campaignRelationOptions.ts` — catálogo de opções (nomes) por ID para labels de chips e facets; honrar `canReadLeadership`/acesso de staff.
  - `src/components/campaign/municipality/MunicipalityList.tsx` + células/actions de estado — liberação da coluna Dobradinhas ao assessor (troca do gate de exibição/edição; server actions e acesso no servidor passando a honrar o portfólio do assessor, como já faz a coluna de Lideranças).
- **Precedente a olhar:** filtro de Assessor na mesma omnibox (maior referência de produto); B143 (`liderancas-omnibox-org-dobradinha.md`) adicionou dimensões por relação na omnibox da lista de lideranças; B155/B157 (colunas — edição de Lideranças já é staff-wide e espelha o caminho para Dobradinhas); B127 (chassis da omnibox); `stateDeputyListUrl` (`NO_PARTY_FILTER_VALUE`, partido no filtro da lista de dobradinhas).
- **Risco de acoplamento:** contrato de URL da lista é congelado (B18) — mudança é **aditiva** (novos params), não re-sêmantiza os existentes; leader lockdown; liberar a coluna Dobradinhas ao assessor **só dentro do portfólio administrado** (o servidor deve rejeitar vínculo fora do escopo — mesmo contrato da coluna de Lideranças); facets nunca vazam nomes fora do escopo do ator.

## Dependências

- Nenhuma dura. Soft: B155 ✓ / B157 ✓ (colunas -> mesmo dado, agora filtrável); B127 ✓ (omnibox); B143 ✓ (precedente de dimensão por relação na omnibox).

## Fora de escopo

- Filtro por **sinal frio/sem atualização** na lista de municípios — gap real identificado, mas outra superfície de decisão; candidato a item/Issue sucessor.
- Popover de filtro no **header das colunas** Lideranças/Dobradinhas (atalho secundário estilo Assessores) — decidido no gate **não**; item/candidato futuro se o uso pedir.
- Criar entidades no combobox; scratch de estimativas; mobile separado; mudar o recorte de outras listas (apoiadores/atividades) para espelhar estes filtros.

## Rabbit holes de produto

- **Recorte reverso = "municípios sem X" desvirtuando a busca.** Se "Sem liderança" virar combinação livre demais (ex. "liderança A OU sem liderança"), a leitura deixa de ser triagem. **Corte:** a semântica segue o precedente de nível ("Sem nível" é um valor no multi-select); vale para os filtros desta lista.
- **Partido como dimensão que depende de dobradinha.** Partido é propriedade da dobradinha; filtrar por partido sozinho precisa da cruzada `stateDeputies` → partido. **Corte:** partido = filtro próprio (OR por sigla, com "Sem partido"), independente do filtro por nome de deputado; o executor combina os dois como qualquer outro multi-filtro da lista.
- **Dois catálogos de nomes divergentes (coluna × filtro).** Chips do filtro devem citar o mesmo nome do contato das colunas. **Corte:** uma única leitura de nomes alimenta coluna e filtro (precedente `loadMunicipalityLeadershipSummaries` / `loadStateDeputyOptions`).
- **Liberar a coluna ao assessor sem fechar o escopo no servidor.** Se a célula abre para o assessor mas as actions deixam gravar vínculo fora do portfólio, vaza dado/escopo. **Corte:** mesma rede de segurança da coluna de Lideranças (options scoped + servidor rejeita município fora do escopo); teste de acesso incluído no aceite.
- **Performance das facets com relação reversa.** Liderança é leitura reversa; na 435-linha o custo extra deve seguir o padrão da facet atual (uma passada por `where`, sem N+1). **Corte:** se exigir otimização além do padrão, medir antes, não "só completar".

## Questões em aberto (produto)

Decididas no gate (2026-08-09) — validadas para registro:

- **Semântica de Dobradinha/Liderança:** multi-valor OR por nome (A), coerente com Assessor/Município.
- **"Sem liderança" / "Sem dobradinha" / "Sem partido":** entram como pseudo-opção (padrão "Sem nível"), recorte de triagem.
- **Filtro por partido da dobradinha:** entra **neste item** (dimensão própria, OR por sigla).
- **Popover de filtro no header das colunas:** **não** — só omnibox.
- **Visibilidade:** todo staff vê **Dobradinha**, **Liderança** e **Partido**; **a coluna Dobradinhas é liberada ao Assessor** (ver/editar inline no portfólio administrado), Lideranças já staff-wide.

Sem perguntas em aberto restantes — recomendações acima validadas pelo produto no gate.

## Referências

- GitHub Issue [#458](https://github.com/fsolla/teqo/issues/458)
- Canvas UI (gate): `~/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b176-ui-draft.canvas.tsx`
- `docs/plans/barra-filtros-omnibox-listas.md` (B127 — contrato da omnibox)
- `docs/plans/liderancas-coluna-municipios.md` (B155) · `docs/plans/dobradinhas-coluna-municipios.md` (B157)
- `docs/plans/liderancas-omnibox-org-dobradinha.md` (B143 — dimensões por relação na omnibox)
- `docs/plans/sollinha-tool-urls-navegacao.md` — nota de que filtros de lista novos = Issue sucessor
- `src/utilities/municipality/municipalityListFilters.ts` · `municipalityOmnibox.ts` · `municipalityListUrl.ts` · `municipalityPageData.ts`
- `AGENTS.md` — "Campaign Municípios model", URL congelada (B18), leader lockdown
