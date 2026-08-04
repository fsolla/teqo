# Colunas responsivas na tabela de Municipios (sem scroll horizontal)

Status: rascunho
Atualizado em: 2026-08-04
Issue: #364
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe em `CampaignTable` / `MunicipalityList` (desktop/tablet); sem rota nova
Canvas UI: /Users/francisco.solla/.cursor/projects/Users-francisco-solla-cursor-worktrees-teqo-5hoy/canvases/plan-b158-ui-draft.canvas.tsx
Appetite: ~1-1,5 dia eng; um outcome verificavel
Responsavel: --

## Intencao

A tabela de Municipios em `/campanha/municipios` tem 10+ colunas no modo staff. Em tablets e laptops de campo (resolucao ~1366x768 ou menor, comum na mesa do assessor), a tabela **estoura a viewport** e forca scroll horizontal. Coordenadores e assessores relatam que o scroll horizontal atrapalha a leitura da fila -- diferentemente do scroll vertical, que e natural, o horizontal quebra a varredura rapida de "quem esta no topo / o que atacar".

O seletor manual de colunas (B17) existe, mas exige que o ator **decida** quais colunas esconder -- uma decisao que a maioria nao toma, ou toma uma vez e esquece. A tela deveria se adaptar sozinha.

Alem disso, varias colunas tem largura ditada pelo **titulo do header** (ex.: "Votos estimados" ocupa mais espaco que os numeros da coluna), e nao pelo conteudo. Em telas estreitas, cada pixel conta.

**Decisoes de produto acumuladas (gate 2026-08-04):**

1. **Territorio na 2a linha do nome** -- a coluna Territorio deixa de existir como coluna independente. O territorio aparece como segunda linha discreta abaixo do nome do municipio, na mesma celula.
2. **"Sem nivel" vira "--"** -- mesmo padrao das colunas 2022 e Classe para ausencia de dado.
3. **Headers no singular + renomeios:** "Assessores" -> "Assessor", "Liderancas" -> "Lideranca", "Dobradinhas" -> "Dobradinha", "Votos estimados" -> "2026" (com tooltip explicando: "Estimativa de votos do candidato neste municipio em 2026"), "Ultimo sinal" -> "Sinal".
4. **Cobertura e Sinal ocultos por padrao** -- colunas de leitura derivada. Comecam pre-povoadas no `hiddenColumnIds` do cookie B17; o ator que quiser ve-las marca no seletor.
5. **Prioridade de colunas por breakpoint** -- CSS-only, sem JS de resize. Mapa de prioridade P0 (sempre visivel) a P5 (opt-in).
6. **Coluna Acoes dinamica** -- nao aparece no seletor B17. Visivel apenas quando **Tendencia OU Sinal** estao ocultos (por breakpoint ou escolha manual). Se ambos estao visiveis, a coluna Acoes some completamente.
   - Tendencia oculta -> icone de Tendencia na coluna Acoes (cor do campo Tendencia: favoravel/neutra/desfavoravel)
   - Sinal oculto -> icone de adicionar sinal na coluna Acoes
   - Ambos ocultos -> ambos os icones

## Persona e fluxo

- **Persona / contexto:** Coordenador-geral ou assessor em tablet/laptop de campo (~1366x768), no calor da operacao, alternando entre a lista e o detalhe de municipio. Precisa escanear rapidamente, nao configurar tabela.
- **Job principal:** Ver as colunas de decisao (nome+territorio, 2022, 2026, nivel, classe) sem scroll horizontal. Quando uma coluna recolhe por falta de espaco, o icone de acao correspondente aparece na coluna Acoes para manter o caminho de escrita acessivel.
- **Fluxo desejado:**
  1. Abre `/campanha/municipios` em qualquer tela >= 1024px. Tabela sem scroll horizontal.
  2. Coluna Acoes aparece no extremo direito **apenas se** Tendencia ou Sinal estiverem ocultos.
  3. Em tela larga com ambas visiveis: coluna Acoes nao renderiza.
  4. Ao estreitar a tela e Tendencia recolher (P3): icone de Tendencia aparece na coluna Acoes, com a cor do status atual.
  5. Ao estreitar mais e Sinal recolher (P5): icone de Sinal aparece na coluna Acoes.
  6. Ambos os icones abrem o mesmo popover que as colunas correspondentes usam hoje.
  7. Nomes longos quebram em ate 2 linhas; territorio em 2a linha truncada.
  8. Headers quebram em 2 linhas quando reduz a largura da coluna (so em whitespace).
- **Anti-goals de produto:**
  - Nao e substituir o seletor manual de colunas (B17) -- ele continua disponivel.
  - Nao e "table-fixed" com larguras CSS arbitrarias.
  - Nao e truncar dados numericos ou badges.
  - Nao e voltar ao scroll horizontal como fallback.
  - Acoes nao aparece no seletor B17 (nao e uma coluna que o ator controla).

### Esboco de fluxo

```text
Desktop largo (>=1400px) -- default: Tendencia visivel, Sinal oculto -> Acoes visivel (icone Sinal)
  [Nome+Territorio | 2022 | 2026 | Assessor | Lideranca | Dobradinha | Tendencia | Nivel | Classe | (S)]
  -> 10 colunas; (S) = icone de Sinal na coluna Acoes

Desktop largo (>=1400px) -- com Sinal habilitado no seletor, Tendencia visivel -> Acoes some
  [Nome+Territorio | 2022 | 2026 | Assessor | Lideranca | Dobradinha | Tendencia | Nivel | Classe | Sinal]
  -> 10 colunas; Acoes oculta (Tendencia e Sinal ambos visiveis)

Tablet (~1200px) -- Tendencia recolhe (P3), Sinal oculto -> Acoes visivel (icones Tendencia + Sinal)
  [Nome+Territorio | 2022 | 2026 | Assessor | Lideranca | Dobradinha | Nivel | Classe | (T)(S)]
  -> 9 colunas; (T) = icone Tendencia colorido, (S) = icone Sinal

Laptop estreito (~1024px) -- P1 e P3 recolhem, P0 + P4 visiveis
  [Nome+Territorio | 2022 | 2026 | Nivel | Classe | (T)(S)]
  -> 6 colunas

Mobile (< 1024px)
  -> Cards (inalterado)
```

## Objetivo e aceite

- **Tabela sem scroll horizontal:** em qualquer viewport >= 1024px, `containerClassName` deixa de ser `overflow-x-auto` e a tabela nao produz barra de rolagem horizontal.
- **Largura segue o conteudo:** colunas com dados curtos (ex.: "2022" com numero de 1-3 digitos + badge, "Nivel" com badge N0-N4) ocupam ~o espaco do dado, nao do titulo do header.
- **Headers com quebra de linha:** onde o titulo do header for mais largo que os dados, o header quebra em 2+ linhas (so em whitespace, nunca no meio de palavra).
- **"Sem nivel" vira "--"** na coluna Nivel -- mesmo padrao das colunas 2022 e Classe para ausencia de dado.
- **Headers no singular + renomeios:** "Assessor", "Lideranca", "Dobradinha", "2026", "Sinal". O header "2026" tem tooltip (B22): "Estimativa de votos do candidato neste municipio em 2026."
- **Territorio na 2a linha do nome:** a coluna `region` deixa de existir. Na celula `name`, abaixo do nome do municipio, o territorio aparece em texto menor e tom secundario. O link para o territorio (`TerritoryLink`) migra para essa segunda linha.
- **Cobertura e Sinal ocultos por padrao:** pre-povoados no `hiddenColumnIds` do cookie B17. O ator habilita manualmente no seletor.
- **Coluna Acoes dinamica (id: `actions`):**
  - NAO aparece no seletor B17 (nao e uma coluna que o ator controla).
  - Renderiza apenas quando **Tendencia ou Sinal** estao ocultos (por breakpoint ou escolha manual B17).
  - Se ambos estao visiveis, a coluna Acoes nao renderiza (nem aparece no DOM).
  - Icone de Tendencia: mesma cor do status atual (verde = favoravel, cinza = neutra, vermelho = desfavoravel). Abre o popover de `MunicipalityListTrendControl`.
  - Icone de Sinal: icone padrao de adicionar. Abre o popover de `MunicipalityListSignalControl`.
  - Ambos os icones coexistem na mesma celula quando ambos estao ocultos.
- **Prioridade de colunas por breakpoint:** CSS-only. Mapa P0-P5 (ver tabela abaixo).
- **Nome com largura maxima:** coluna `name` com `max-w-52` (~208px); nomes quebram em 2 linhas. Territorio truncado em 1 linha.
- **Coluna `name` mantem sticky left.**
- **Seletor B17 preservado:** o manual vence o automatico. Coluna Acoes nao aparece no seletor.
- **Sem regressao no mobile:** cards `< md` seguem inalterados.
- **Guardrails:** sem migration, sem collection, sem Consent, sem server action; sem mudanca no contrato de URL; sem novo cookie.

## Dados (intencao)

- **Vou apresentar dados?** Nao -- **Dados: N/A**. Layout/CSS de colunas existentes.
- **Decisoes desbloqueadas:** Nenhuma decisao eleitoral nova.
- **Forma:** *adiada ao plano de implementacao*.

## Mapa de prioridade das colunas (canonico)

Fonte unica de default, prioridade e breakpoint para TODAS as colunas da tabela de municipios -- existentes e futuras. Quem adicionar uma coluna nova atualiza esta tabela.

**Breakpoints:** >= 1400px (wide), >= 1200px (medium), >= 1024px (narrow), < 1024px (mobile cards).

| # | Coluna | ID | Header | Default | Prio | >= 1400px | >= 1200px | >= 1024px |
|---|--------|----|--------|---------|------|-----------|-----------|-----------|
| 1 | Nome (+Territorio) | `name` | Municipio | visivel | P0 | OK | OK | OK |
| 2 | 2022 | `votos` | 2022 | visivel | P0 | OK | OK | OK |
| 3 | 2026 | `expectedVotes` | 2026 | visivel | P0 | OK | OK | OK |
| 4 | Assessor | `advisors` | Assessor | visivel | P1 | OK | OK | OK |
| 5 | Lideranca (futuro: B155) | `leaderships` | Lideranca | visivel | P1 | OK | OK | OK |
| 6 | Dobradinha (futuro) | `stateDeputies` | Dobradinha | visivel | P1 | OK | OK | OK |
| 7 | Tendencia | `trend` | Tendencia | visivel | P3 | OK | OK | -- |
| 8 | Nivel | `level` | Nivel | visivel | P4 | OK | -- | -- |
| 9 | Classe | `classe` | Classe | visivel | P4 | OK | -- | -- |
| -- | **Acoes** | `actions` | *(sem header)* | dinamica | -- | se Tend ou Sinal ocultos | mesmo | mesmo |
| 10 | Cobertura | `goalCoverage` | Cobertura | **oculta** | P5 | OK (se opt-in) | -- | -- |
| 11 | Sinal | `lastSignal` | Sinal | **oculta** | P5 | OK (se opt-in) | -- | -- |

**Notas:**
- Territorio nao e coluna -- e 2a linha do Nome (sempre visivel).
- Default = estado inicial para novos atores (pre-povoado no cookie B17). Colunas `oculta` entram em `hiddenColumnIds`.
- **Acoes e dinamica:** renderiza apenas quando Tendencia OU Sinal estao ocultos. Se ambos visiveis, nao renderiza. Nao aparece no seletor B17.
- Ordem visual (esquerda -> direita): linhas 1-9 + Acoes (extremo direito, quando visivel). 10 e 11 aparecem antes de Acoes quando habilitadas.
- Colunas futuras (5 e 6): P1, visiveis por default, recolhem abaixo de 1200px.
- Breakpoints sao CSS-only (`hidden lg:table-cell`, `hidden xl:table-cell`, etc.).

## Direcao no codebase (hipotese)

- **Areas provaveis:**
  - `src/components/campaign/municipality/MunicipalityList.tsx` -- definicao de colunas e render. A coluna `region` some; entra `actions` (dinamica). Headers atualizados para singular + "2026" + "Sinal".
  - `src/utilities/municipality/municipalityListUrl.ts` -- `municipalityColumnLabels` atualizado: perde `region`, renomeia headers, ganha `actions`; `municipalityListSortLabels` atualizado (ex.: `expectedVotes: '2026'`).
  - `src/utilities/municipality/municipalityLabels.ts` -- `MunicipalityListColumnId` perde `'region'`, ganha `'actions'`; `municipalityColumnDescriptions` atualizado (ex.: `expectedVotes` descreve "Estimativa de votos... 2026").
  - `src/components/campaign/municipality/MunicipalityListSignalControl.tsx` -- reusado na coluna `actions` com icone em vez de `SignalAgeReadout`.
  - `src/components/campaign/municipality/MunicipalityListTrendControl.tsx` -- reusado na coluna `actions` com icone colorido.
  - `src/components/campaign/shared/CampaignTable.tsx` -- seam para `containerClassName` sem `overflow-x-auto`.
  - `src/components/ui/Table.tsx` -- sobrescrever `whitespace-nowrap` via `className` nas colunas de municipios.
  - `src/lib/campaignColumnVisibility.ts` -- `resolveVisibleColumns`; a prioridade por breakpoint e CSS (`hidden lg:table-cell` etc.).
- **Coluna Acoes dinamica:** a decisao "renderiza ou nao" e client-side, baseada em quais colunas estao visiveis apos aplicar B17 + breakpoints. Pode ser implementada como:
  - Um `useMemo` no componente `MunicipalityList` que verifica se `trend` e `lastSignal` estao em `hiddenColumnIds` OU seriam escondidas pelo breakpoint atual.
  - Ou CSS puro: a coluna Acoes tem `hidden` condicional + uma media query que a mostra quando as colunas alvo estao `hidden`.
- **Colunas futuras (B155 + Dobradinhas):** mesmo contrato de antes -- P1, visiveis por default, recolhem abaixo de 1200px.
- **Precedente a olhar:** B17, B41, `TerritoryList.tsx`.
- **Risco de acoplamento:** `ui/Table` e base compartilhada -- sobrescrever `whitespace-nowrap` so nas colunas de municipios.

## Dependencias

- Suave: B17 (seletor manual) -- coexiste; este item pre-povoa `hiddenColumnIds` com `['lastSignal', 'goalCoverage']`.
- Suave: B41 (scroll horizontal) -- este item remove o `overflow-x-auto`.
- Suave: B155 (coluna Liderancas) e coluna Dobradinhas -- nao bloqueiam; este plano reserva posicao e prioridade.
- Nenhuma dura.

## Fora de escopo

- Cards mobile (< 1024px).
- Outras listas alem de `/campanha/municipios`.
- Resize manual, drag-and-drop, prioridade configuravel por ator.
- Icones adicionais na coluna Acoes alem de Tendencia e Sinal.
- Implementar as colunas Liderancas (B155) e Dobradinhas.

## Rabbit holes de produto

- **Container queries vs breakpoints fixos.** **Corte:** breakpoints Tailwind alinhados com o shell.
- **"Prioridade configuravel por ator".** **Corte:** prioridade fixa no codigo.
- **Acoes dinamica vs B17.** A coluna Acoes nao aparece no seletor -- evitar que o ator a desmarque e perca o caminho de escrita. **Corte:** `actions` nao entra em `municipalityListPickerColumns`.

## Questoes em aberto (produto)

- **Ordem visual das colunas de rede:** Assessor, Lideranca, Dobradinha, Tendencia -- ou Assessor, Tendencia, Lideranca, Dobradinha? **Recomendacao:** Assessor, Lideranca, Dobradinha, Tendencia (pessoas vinculadas antes da leitura politica). _(assumido)_
- **Cor do icone de Tendencia na coluna Acoes:** replica a cor do badge do status atual (verde/amarelo/vermelho/cinza) ou usa uma cor neutra? **Recomendacao:** replica a cor do status -- o icone substitui a coluna, entao deve comunicar a mesma informacao. _(assumido)_
- **Header "2026" precisa de tooltip?** Sim -- `municipalityColumnDescriptions.expectedVotes`: "Estimativa de votos do candidato neste municipio em 2026. Ordena pelo cenario central, independente do cenario selecionado acima." _(assumido)_

## Referencias

- `src/components/campaign/municipality/MunicipalityList.tsx`
- `src/components/campaign/shared/CampaignTable.tsx`
- `src/components/ui/Table.tsx`
- `src/lib/campaignColumnVisibility.ts`
- `src/utilities/municipality/municipalityListUrl.ts`
- `src/utilities/municipality/municipalityLabels.ts`
- `docs/plans/seletor-colunas-lista-municipios.md` -- B17
- `docs/plans/scroll-horizontal-lista-municipios.md` -- B41
- B155 (Issue #359) -- coluna Liderancas (futuro)
- Canvas UI: `/Users/francisco.solla/.cursor/projects/Users-francisco-solla-cursor-worktrees-teqo-5hoy/canvases/plan-b158-ui-draft.canvas.tsx`
