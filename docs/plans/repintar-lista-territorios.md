# B175 — Repintar a lista de Territórios no padrão da lista de Municípios

Status: registrado (blocked até o plano em `main`)
Atualizado em: 2026-08-08
Issue: #451
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na tabela existente de `/campanha/territorios` (colunas/células/densidade); sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b175-ui-draft.canvas.tsx
Appetite: ~1,5–2 dias eng; um outcome verificável
Responsável: —

## Intenção

A lista de `/campanha/territorios` ainda usa o layout “v1” do B21/E12: colunas Municípios, Votos 2022, % da própria votação, Válidos 2022, Estimativa 2026 (média), Cobertura da meta, Captura (2022), Classe e Assessoria (X de N). Com quase 10 colunas ela estoura o painel e depende de rolagem horizontal — o exato problema que a lista de Municípios resolveu no B158 (colunas adaptativas por largura do painel, sem scroll, headers curtos, % absorvido na célula).

Pedido (2026-08-08): repintar a lista de Territórios no mesmo padrão — cabeçalhos curtos, contagem de municípios colada ao nome, % e válidos absorvidos na célula de 2022, estimativa 2026 com o mesmo detalhe da lista de Municípios (mas só leitura), e ganhar as colunas de rede (Assessor, Liderança, Dobradinha) em leitura.

## Persona e fluxo

- **Persona / contexto:** coordenador, candidato ou assessor comparando os 27 Territórios de Identidade num painel cuja largura varia com sidebar e chat. Em campo, no tablet, precisa da leitura regional completa sem esforço de navegação.
- **Job principal:** escanear território → base de 2022 (%, votos, válidos) → captura → estimativa de 2026, e enxergar responsabilidade (assessor/assessoria) e rede (liderança, dobradinha) sem clicar em nada.
- **Fluxo desejado:**
  1. Abre `/campanha/territorios` com o núcleo sempre visível: Território (com “(N)” do nº de municípios), 2022, 2026.
  2. Mais largura do painel acrescenta uma coluna por vez: Captura, depois Classe/Assessoria, depois Assessor/Liderança/Dobradinha.
  3. “Cobertura” (meta) aparece só se o ator ligar no seletor de colunas.
  4. Nunca rola na horizontal; fechar sidebar/chat recolhe colunas na hora, sem recarregar.
- **Anti-goals de produto:** não virar planilha (sem edição de célula nesta lista, sem reorder DnD); não reabrir cards mobile (a lista de Territórios não tem); não quebrar a leitura por sub-linhas do Metropolitano (Salvador × Demais RMS); não mudar a ordem default (maior % da própria votação primeiro) nem os contratos de URL.

### Esboço de fluxo (B)

```text
[abre /campanha/territorios] → núcleo Território(10) · 2022 · 2026
  → painel mais largo → +Captura · +Classe · +Assessoria (n/n)
  → painel largo → +Assessor · +Liderança · +Dobradinha (só leitura)
  → "Cobertura" entra só se o ator ligar no seletor de colunas
  → sidebar/chat fecham → recolhe na mesma ordem, nunca rola horizontal
```

## Objetivo e aceite

- A linha do território mostra o nome com a contagem de municípios entre parênteses — “Metropolitano de Salvador (40)” — sem coluna própria de Municípios; as sub-linhas do Metropolitano mantêm a mesma convenção.
- Headers ficam curtos: **2022** (era “Votos 2022”), **2026** (era “Estimativa 2026 (média)”), **Captura** (era “Captura (2022)”), **Cobertura** (era “Cobertura da meta”), **Classe**, **Assessoria** (n/n com assessor).
- A coluna **% da própria votação** sai da tabela; a célula de **2022** passa a levar o % junto com os votos e a célula de **2026** também mostra o % como linha secundária, junto do número — espelho da lista de Municípios (decisão do gate: % nas duas colunas).
- A coluna **Válidos 2022** sai; o valor de votos válidos é o **conteúdo exclusivo do hover** da célula de 2022 (sem a série 2014/2018, que sai da célula para não empilhar informação).
- A célula de **2026** mostra o mesmo detalhe da coluna análoga de Municípios (valor + faixa de cenários no hover), **sem edição** — estimativas continuam declaradas por município.
- Novas colunas **só leitura**: **Assessor** (quem assessora o território), **Liderança** (lideranças do território), **Dobradinha** (dobradinhas do território). Nenhuma delas abre editor.
- **Cobertura** nasce oculta por padrão no seletor de colunas (como na lista de Municípios).
- Em desktop, a tabela é responsiva à largura do **painel de conteúdo** (não da viewport): menos espaço → menos colunas, na ordem P0 → P1 → P2 → P3; **nunca** rolagem horizontal.
- Ordem visual das colunas quando todas visíveis: `<Território><2022><Captura><2026><Assessor><Liderança><Dobradinha><Classe><Assessoria><Cobertura>`.
- Guardrails: `leader` segue fora (barreira da rota intacta); a leitura regional permanece por agregado (soma/contagem por TI, nunca dado de município individual); filtros/sort/URL (“coverage”, “region”, sort legado) continuam válidos; sub-linhas do Metropolitano acompanham pai (nunca ordenam sozinhas).

## Dados (intenção)

- **Vou apresentar dados?** Sim — superfície neste item (células 2022/2026/Captura/Cobertura e colunas de rede).
- **Decisões desbloqueadas:** (mesa) comparar os 27 TIs por votação própria relativa ao Estado e por captura regional, decidindo onde falta responsável (assessoria) e onde a rede existe (liderança/dobradinha).
- **Restrições de produto:** a leitura é relativa/local por TI — nunca % estadual absoluto como grade central; a captura do território continua a soma dos votos próprios ÷ soma dos tetos (nunca média das capturas municipais — MAUP); o % da própria votação é atributo histórico de 2022 e, por decisão de produto, aparece também como linha secundária na célula 2026.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `/campanha/territorios` (`src/app/(campaign)/campanha/(app)/territorios/page.tsx`); componentes `TerritoryList.tsx`, `TerritoryListColumns.tsx`, `TerritorySortableHead.tsx`, `TerritoryFilters.tsx` (pasta `src/components/campaign/municipality/`); utilitários `src/utilities/territory/` (`territoryOverview.ts`, `territoryListUrl.ts`, `territoryListLabels.ts`, `territoryOmnibox.ts`, loader `loadTerritoryOverview.ts`); pref. de colunas em `src/lib/campaignColumnVisibility.ts` / `src/utilities/campaignColumnVisibilityCookie.ts`.
- **Precedente a olhar:** B158 (`docs/plans/colunas-responsivas-municipios.md` + `MunicipalityList.tsx` — container queries, headers curtos, defaults ocultos, sem scroll) e as células análogas: `MunicipalityVotePositionReadout` (célula 2022), `StaffMunicipalityVotesDisplay` (célula 2026, hover com cenários), `MunicipalityAdvisorAvatarStack` / leitura de rede (B155/B157).
- **Risco de acoplamento:** preservar os sort keys de colunas que deixam a tabela (logo `pct` = default, `municipalities`, `validVotes2022`) válidos via omnibox/resumo — só o header clicável some; manter a decomposição do Metropolitano e o acesso por agregado; não tocar em migração nem em `Consent`.

## Dependências

- Nenhuma dura.
- Soft (já em `main`): B158 ✓ (padrão container query + defaults de colunas), B155 ✓ / B157 ✓ (displays de rede), B17 ✓ (seletor/cookie de colunas), B23 ✓ (tooltip de célula), B22 ✓ (descrição no header).

## Fora de escopo

- Edição de célula nesta lista (não existe hoje e não vai existir com este item).
- Reorder/drag de colunas; redimensionamento manual.
- Cards mobile de Territórios (não existem; a leitura do container estreito para no núcleo P0).
- Aplicar o padrão às demais listas (lideranças, dobradinhas, organizações…).
- Mudar fórmulas (captura, cobertura de meta, %), a malha TI ou a decomposição do Metropolitano.
- Nova rota de detalhe por TI; seletor de cenário (a lista segue lendo o cenário default).

## Rabbit holes de produto

- **“Só mais uma coluna” até virar planilha regional.** Depois do % e dos válidos absorvidos e das 3 colunas de rede, qualquer métrica nova (tendência, gap, LQ) vira outro pedido. **Corte neste item:** a matriz P0–P3 acima é o teto.
- **“Assessor/Liderança/Dobradinha” viram mini-editor de município.** A leitura por TI agrega; a edição mora no município. **Corte:** células só leitura (stack/chips + contagem + tooltip), sem duplicar os editores do B155/B157.
- **Loader perde o fôlego.** Agregar assessores/lideranças/dobradinhas por TI em consulta por linha deixaria 27×N queries. **Corte:** agregação em lote por municípios (poucas consultas) e dedup por território — sem N+1 por TI.
- **Renomear sort keys / quebrar URL.** “Assessoria” vira botão de edição, “Cobertura” perde o significado. **Corte:** só strings visíveis mudam; keys internas e `?sort=` ficam.

## Questões em aberto (produto)

- **Onde o “% da própria votação” entra?** **Resolvida no gate (B):** nas duas colunas — 2022 mostra % + votos (espelho de Municípios) e 2026 mostra o número com o % como linha secundária e a faixa de cenários no hover.
- **Onde “Captura” entra na matriz de densidade?** **Resolvida no gate (B):** faixa P1, junto de Classe/Assessoria — não faz parte do núcleo P0.
- **Coluna de Assessor: o que mostra por TI?** **Confirmado no gate** (a leitura “Assessoria = X-de-N, Assessor = nomes”): opção **A** — conjunto de assessores dos municípios do TI (avatar compacto + contagem, nomes no tooltip — padrão Municípios); a contagem “n/n” continua na coluna Assessoria.
- **Célula 2022: manter a série 2014/2018 no detalhe?** **Resolvida no gate (Não):** o hover da célula 2022 mostra **apenas** os votos válidos; a série 2014/2018 sai (demais informação no mesmo gesto).
- **Rank “Nº de X” na célula 2022?** **Resolvida no gate:** seguir a recomendação — sem rank de TI; a linha secundária mostra os votos (os válidos ficam no hover).

## Referências

- GitHub Issue #451
- Canvas UI (gate): [plan-b175-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b175-ui-draft.canvas.tsx)
- `docs/plans/colunas-responsivas-municipios.md` (B158 — padrão a espelhar), `docs/plans/pagina-territorios-identidade.md` (B21 — origem da página), `docs/plans/camada-territorios-identidade.md` (E12 — colunas atuais), `docs/plans/tabela-ti-inicio.md` (E17 — rollup)
- `src/components/campaign/municipality/TerritoryList*.tsx`, `src/utilities/territory/*.ts`, `src/components/campaign/municipality/MunicipalityVotePositionReadout.tsx`, `src/components/campaign/votePledge/StaffMunicipalityVotesDisplay.tsx`
- AGENTS.md — convenções de lista/access; leitura regional por agregado (não PII de município)
