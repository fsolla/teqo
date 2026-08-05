# B158 — Colunas adaptativas na tabela de Municípios

Status: rascunho revisado
Atualizado em: 2026-08-05
Issue: #364
Priority: P1
Model: composer-2.5
Impeccable: Adapt / modo Operate — densidade progressiva dentro do painel de conteúdo
Canvas UI: `/Users/francisco.solla/.cursor/projects/Users-francisco-solla-cursor-worktrees-teqo-5hoy/canvases/plan-b158-ui-draft.canvas.tsx` (referência histórica; o contrato abaixo prevalece)
Appetite: ~1,5–2 dias eng; um outcome verificável
Responsável: —

## Intenção

A tabela de Municípios em `/campanha/municipios` tem 10+ colunas no modo staff. O espaço útil não depende mais apenas da viewport: a página pode dividir a largura entre **sidebar, painel de conteúdo e chat**, cada um aberto ou fechado. Breakpoints de tela não representam o espaço que a tabela realmente recebeu.

A lista deve responder à largura do **painel de conteúdo**, mostrar primeiro as colunas que sustentam a decisão e acrescentar as demais uma a uma conforme houver espaço — sem scroll horizontal e sem exigir configuração prévia do ator.

O seletor manual de colunas (B17) continua existindo. Ele expressa preferência; as container queries expressam capacidade física do painel.

## Decisões de produto consolidadas

1. **Container queries, não media queries.** O wrapper da lista vira um named container. Abrir ou fechar sidebar/chat recalcula as colunas sem JavaScript de resize.
2. **Território na segunda linha do nome.** A coluna `region` deixa de existir. `TerritoryLink` aparece sob o nome do município, em texto secundário e truncado.
3. **Filtro de território preservado no omnibox.** `MunicipalityFilters` já oferece sugestões e chips de território; essa passa a ser a entrada canônica. Remover a coluna não remove `regionFilterOptions`, `?region=` nem o estado do filtro.
4. **Sort legado por território preservado.** `sort=region` continua válido por compatibilidade de URL e aparece no resumo quando ativo, mas deixa de ter um header clicável. Não será criada uma segunda affordance de sort neste item.
5. **Ausência de nível vira `—`.** O filtro `sem_nivel` continua sendo uma resposta operacional real; somente a célula usa o padrão visual de ausência.
6. **Headers curtos:** `Assessor`, `Liderança`, `Dobradinha`, `2026`, `Sinal`. O header `2026` explica a estimativa no tooltip B22.
7. **Cobertura e Sinal ocultos por padrão.** Novos estados de preferência começam com `goalCoverage` e `lastSignal` ocultos; ambos continuam disponíveis no seletor.
8. **Densidade progressiva.** Colunas entram individualmente conforme o container cresce. `Tendência` e `Sinal` são adaptativas: usam ícone compacto quando não cabe o readout completo, sem montar um segundo editor.
9. **Ações cobre apenas ocultação manual.** Se o ator ocultar `trend` ou `lastSignal`, a coluna interna `actions` monta o editor correspondente. Container query nunca duplica o controle: uma coluna adaptativa compacta no próprio lugar.
10. **Sem fallback horizontal.** A tabela não usa `overflow-x-auto`; cards continuam sendo a superfície do container realmente estreito.

## Persona e job

- **Persona:** coordenador, candidato ou assessor usando tablet/laptop de campo, com sidebar e/ou chat alternando o espaço disponível.
- **Job:** escanear nome, base de 2022, estimativa de 2026, nível e classe; reconhecer tendência e manter ações rápidas acessíveis; receber mais contexto de rede conforme o painel cresce.
- **Princípio:** adaptar ao espaço que o conteúdo recebeu, não ao dispositivo que o hospeda.

## Fluxo desejado

1. O painel de conteúdo abre estreito: a lista usa cards.
2. Ao ganhar largura suficiente, entra a tabela essencial.
3. Cada faixa adicional introduz uma coluna, sem salto de três ou quatro colunas de uma vez.
4. Abrir o chat ou a sidebar faz o processo inverso imediatamente via CSS.
5. `Tendência` e `Sinal`, quando escolhidos no B17, encolhem para um trigger de ícone antes de desaparecerem.
6. Se o ator os ocultar manualmente, seus triggers migram no render do servidor para `Ações`, no extremo direito.
7. O filtro de território continua disponível no omnibox e seus chips continuam refletindo `?region=`.

## Contrato entre preferência e capacidade

A regra efetiva é:

```text
coluna renderizada = permitida pelo papel
                  AND não ocultada manualmente
                  AND faixa do container permite a coluna
```

Exceções:

- `name` é obrigatória.
- `trend` e `lastSignal`, quando manualmente visíveis, permanecem renderizados na tabela e alternam **compacto ↔ completo** conforme o container.
- Se `trend` ou `lastSignal` estiver manualmente oculto, seu editor é renderizado uma única vez dentro de `actions`.
- Mostrar manualmente uma coluna não força o painel a ultrapassar sua capacidade. O automático vence apenas na dimensão de espaço; a preferência continua guardada para quando houver largura.

## Matriz canônica por largura do container

Os valores abaixo são **breakpoints iniciais do painel de conteúdo**, não da viewport. Devem ser calibrados no craft contra o conteúdo real, mas a ordem de entrada é contrato de produto. Uma calibração pode mover um corte; não pode agrupar colunas nem trocar a prioridade sem atualizar este plano.

| Faixa do container  | Superfície / coluna que entra | Estado acumulado                                                                    |
| ------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `< 48rem` (< 768px) | Cards                         | Cards existentes; tabela ausente                                                    |
| `C0 >= 48rem`       | Tabela essencial              | Nome+Território, 2022, 2026, Nível, Classe, Tendência compacta, Ações se necessária |
| `C1 >= 54rem`       | Assessor                      | C0 + Assessor                                                                       |
| `C2 >= 60rem`       | Tendência completa            | C1; trigger troca ícone por badge/readout no mesmo controle                         |
| `C3 >= 66rem`       | Liderança                     | C2 + Liderança                                                                      |
| `C4 >= 72rem`       | Dobradinha                    | C3 + Dobradinha, somente coordinator/candidate                                      |
| `C5 >= 78rem`       | Cobertura opt-in              | C4 + Cobertura, se habilitada no B17                                                |
| `C6 >= 84rem`       | Sinal completo opt-in         | C5; Sinal, se habilitado, troca ícone por readout de idade                          |

### Ordem visual estável

Quando todas estão disponíveis:

1. `name` — Município + Território
2. `votos` — 2022
3. `expectedVotes` — 2026
4. `level` — Nível
5. `classe` — Classe
6. `advisors` — Assessor
7. `trend` — Tendência
8. `leaderships` — Liderança
9. `stateDeputies` — Dobradinha, quando o papel permite
10. `goalCoverage` — Cobertura, opt-in
11. `lastSignal` — Sinal, opt-in
12. `actions` — somente quando Tendência e/ou Sinal foram ocultos manualmente

A ordem prioriza diagnóstico/decisão, depois responsabilidade e rede. A tabela não muda a ordem ao cruzar faixas; apenas acrescenta ou compacta células.

## Colunas adaptativas e montagem única

### Tendência

- Manualmente visível:
  - C0–C1: um trigger de ícone com cor semântica do status atual.
  - C2+: o mesmo `MunicipalityListTrendControl` mostra o badge completo.
- Manualmente oculta: a coluna `trend` não é renderizada e uma única instância do controle aparece em `actions`.
- Estado sem tendência usa ícone neutro e nome acessível “Tendência não registrada”.

### Sinal

- Manualmente visível:
  - C0–C5: o mesmo `MunicipalityListSignalControl` usa trigger de adicionar/atualizar sinal.
  - C6+: troca para `SignalAgeReadout` no mesmo controle.
- Manualmente oculto: uma única instância aparece em `actions`.

### Ações

- ID interno: `actions`.
- Não entra em `MunicipalityListColumnId`, `municipalityColumnLabels`, `municipalityColumnDescriptions` nem no picker B17.
- Usa um tipo local, por exemplo `MunicipalityTableColumnId = MunicipalityListColumnId | 'actions'`.
- Possui header visualmente oculto “Ações” para manter a semântica da tabela.
- Só entra no DOM quando `trend` ou `lastSignal` está manualmente oculto.
- Os triggers têm nome acessível, tooltip redundante e alvo mínimo de 44×44px.
- Nunca existem duas instâncias do mesmo editor na mesma linha.

## Defaults do B17 sem ambiguidade

O cookie atual omite uma lista cujo conjunto de ocultas é vazio. Portanto, “nunca configurou” e “restaurou todas” são indistinguíveis. B158 precisa evoluir o formato antes de aplicar defaults.

### Contrato escolhido

- O formato passa a representar explicitamente uma lista configurada com zero ocultas, usando um sentinel reservado e versionado pelo parser/serializer.
- Exemplo conceitual: `municipios:__none__` significa “configurado; todas visíveis”. O sentinel nunca é exposto como column ID.
- Ausência da entrada `municipios` significa “usar defaults atuais da lista”.
- Defaults de Municípios: `['goalCoverage', 'lastSignal']`.
- `Restaurar todas` persiste o estado explícito vazio; não volta aos defaults no refresh.
- Cookies legados sem entrada de Municípios adotam o novo preset compacto uma vez. Após a primeira interação, o estado fica explícito.
- As outras listas mantêm default vazio e comportamento existente.
- O controle continua sendo preferência por dispositivo/browser, não por usuário autenticado.

## Objetivo e aceite

- A tabela responde à largura do named container do painel de conteúdo, inclusive quando sidebar/chat abrem ou fecham sem mudar a viewport.
- Não há barra de rolagem horizontal nem overflow do shell em nenhuma faixa de tabela.
- A transição cards ↔ tabela é baseada no container em 48rem.
- As colunas entram uma por vez na ordem C0–C6.
- `name` continua sticky left e passa a ter largura máxima aproximada de 13rem; nome quebra em até duas linhas e território trunca em uma.
- Headers podem quebrar apenas em whitespace; números e badges não truncam.
- Território continua filtrável no omnibox; chips e URLs `?region=` permanecem intactos.
- URLs legadas com `sort=region` continuam válidas.
- `Nível` sem valor renderiza `—`.
- Headers e labels usam singular; `2026` tem tooltip: “Estimativa de votos do candidato neste município em 2026. Ordena pelo cenário central, independente do cenário selecionado acima.”
- Cobertura e Sinal começam ocultos nos defaults de Municípios.
- `actions` não aparece no picker e só existe no DOM por ocultação manual de Tendência/Sinal.
- Cada editor de Tendência/Sinal é montado no máximo uma vez por linha.
- Cards mantêm conteúdo e interação atuais; somente o gatilho cards/tabela muda de media query para container query.
- Sem migration, collection, Consent, server action ou mudança de contrato público de URL.

## Direção no codebase

### `MunicipalityList.tsx`

- Envolver cards + tabela em `@container/municipality-list`.
- Trocar `md:hidden` / `md:block` por variantes do named container.
- Remover a definição `region`; mover `TerritoryLink` para a segunda linha de `name`.
- Reordenar as definições conforme a ordem visual canônica.
- Aplicar classes de container query simétricas ao `<th>` e `<td>` de cada coluna.
- Remover `containerClassName="overflow-x-auto"`; usar overflow visível/oculto sem scroller horizontal.
- Calcular no servidor somente a ocultação manual para decidir `actions`.
- Não usar `window`, `ResizeObserver`, `useMediaQuery` ou `useMemo` de viewport.

### Controles

- `MunicipalityListTrendControl.tsx`: adicionar seam tipado de apresentação (`compact`/`full` ou triggers responsivos dentro da mesma instância), preservando `triggerLabel`, autosave e feedback.
- `MunicipalityListSignalControl.tsx`: reutilizar o `children` já existente para alternar ícone/readout dentro da mesma instância.
- Ícones não duplicam significado apenas por cor: `aria-label` sempre inclui o estado textual.

### Filtro e URL

- `MunicipalityFilters.tsx` e `municipalityOmnibox.ts`: sem mudança comportamental; manter `regionFilterOptions`, sugestões e chips.
- `municipalityListUrl.ts`: manter `region` em `MunicipalityListSortKey`, parsing, serialização e labels de sort; remover apenas `region` de `municipalityColumnLabels` quando o tipo de coluna deixar de incluí-la.
- Estado ativo `sort=region` continua anunciado por `formatMunicipalityListSortSummary`.

### Tipos e labels

- `MunicipalityListColumnId` perde `region`.
- `actions` fica em união local da tabela, não nos records canônicos do picker/B22.
- Atualizar labels para singular e `expectedVotes` para label/header apropriados: picker “Estimativa 2026”, header “2026”. Se necessário, separar label serializável do texto telegráfico do header, seguindo o precedente de `votos`.

### Cookie B17

- `campaignColumnVisibility.ts`: parser/serializer distinguem entrada ausente de conjunto explicitamente vazio; testes de round-trip cobrem o sentinel.
- `campaignColumnVisibilityCookie.ts`: aplica defaults por lista somente quando a entrada está ausente.
- `CampaignColumnPicker.tsx`: `Restaurar todas` persiste vazio explícito.

### Shared table

- Evitar alterar `ui/Table` globalmente.
- `CampaignTable` só ganha seam compartilhado se a implementação provar que classes simétricas de head/cell não podem ficar na definição local. Não criar API genérica por antecipação.

## Verificação obrigatória

### Unit/static markup

- Ordem das colunas e labels por papel.
- `region` ausente da tabela/picker, mas presente no parser/serializer de URL e no omnibox.
- `actions` ausente do picker.
- `actions` ausente do DOM quando Tendência e Sinal estão manualmente visíveis.
- Cada cenário manual (`trend`, `lastSignal`, ambos ocultos) monta exatamente um editor por linha.
- Tendência e Sinal contêm variantes compacta/completa na mesma instância, controladas apenas por CSS.
- Nível nulo renderiza `—`.
- Cookie: legado ausente → defaults; vazio explícito → todas; restaurar todas sobrevive ao round-trip; outras listas não mudam.

### Browser/E2E

Testar o **container**, não apenas presets de viewport:

1. painel `<48rem`: cards visíveis, tabela ausente;
2. C0, C1, C2, C3, C4, C5 e C6, incluindo 1px antes/depois de cada corte;
3. mesma viewport com sidebar/chat em combinações aberto/fechado;
4. `tableContainer.scrollWidth <= tableContainer.clientWidth` em todas as faixas;
5. nomes longos de município/território e relações com muitos nomes;
6. coordinator/candidate com Dobradinha e advisor sem essa coluna;
7. teclado e leitor de tela nos triggers compactos;
8. touch target mínimo de 44px;
9. Chrome e Safari/iPad para sticky left + container query.

Os cortes podem ser ajustados uma vez no craft com evidência de `scrollWidth`, em lote. Depois da calibração, os valores finais ficam pinados nos testes; não criar loop de microajustes.

## Dependências

- B17 entregue — requer evolução compatível do formato do cookie.
- B41 entregue — B158 substitui o scroller horizontal da lista de Municípios; não altera outras listas.
- B155 e B157 entregues — Liderança e Dobradinha já são colunas reais e entram na matriz.
- Nenhuma dependência dura externa.

## Fora de escopo

- Mudar conteúdo ou controles dos cards.
- Aplicar container-query columns às outras listas.
- Reorder manual, resize, drag-and-drop ou prioridade configurável.
- Novo sort de território no omnibox.
- Otimizar loaders conforme coluna visível.
- Novos ícones de ação além de Tendência e Sinal.

## Rabbit holes cortados

- **Breakpoints de viewport:** rejeitados; três painéis tornam viewport um proxy incorreto.
- **JavaScript de resize:** rejeitado; Tailwind/CSS container queries resolvem o layout sem hidratação adicional.
- **Duplicar popovers entre coluna e Ações:** rejeitado; cada editor monta uma vez.
- **`table-fixed` e larguras arbitrárias por coluna:** rejeitado; conteúdo dita largura, com apenas limites no nome e modos compactos explícitos.
- **Scroll horizontal como rede de segurança:** rejeitado; teste de `scrollWidth` é gate.
- **Mostrar manualmente acima da capacidade:** rejeitado; preferência não pode estourar o painel.

## Referências

- `src/components/campaign/municipality/MunicipalityList.tsx`
- `src/components/campaign/municipality/MunicipalityFilters.tsx`
- `src/components/campaign/municipality/MunicipalityListTrendControl.tsx`
- `src/components/campaign/municipality/MunicipalityListSignalControl.tsx`
- `src/components/campaign/shared/CampaignTable.tsx`
- `src/components/campaign/shared/CampaignColumnPicker.tsx`
- `src/lib/campaignColumnVisibility.ts`
- `src/utilities/campaignColumnVisibilityCookie.ts`
- `src/utilities/municipality/municipalityListUrl.ts`
- `src/utilities/municipality/municipalityLabels.ts`
- `docs/plans/seletor-colunas-lista-municipios.md` — B17
- `docs/plans/scroll-horizontal-lista-municipios.md` — B41
