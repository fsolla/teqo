# B127 — Barra omnibox de filtros nas listas `/campanha`

Status: registrado
Atualizado em: 2026-08-02
Issue: #264
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: C — fluxo novo de filtragem nas barras de lista existentes (padrão tipo GitHub PR / Datadog)
Appetite: ~2 dias eng no piloto Municípios + chassis compartilhado; mapa de variantes de produto já fecha o contrato das demais listas (adoção = B128)
Responsável: —

## Intenção

Nas listas de `/campanha` (ex. Municípios), a barra de controle virou um empilhamento: busca, seletor de cenário, “Ordenado por …”, selects/comboboxes no mobile e filtros no header no desktop. Em viewport estreita isso compete com o conteúdo e força o staff a caçar o controle certo.

Queremos **uma** barra de filtro estilo omnibox (GitHub PR filters, Datadog, etc.): o usuário digita, a barra sugere dimensões/valores a partir do texto, e o que já está aplicado aparece como chips **dentro** do input — removíveis com um clique — com o caret à direita para continuar filtrando. Sem fileira paralela de busca / cenário / ordenação / selects empilhados.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral ou Assessor na mesa ou no celular, varrendo uma lista para montar um recorte (prioritárias + território + assessor, etc.) sob pressão de tempo.
- **Job principal:** montar e ajustar um recorte multi-dimensão sem sair da barra e sem caçar controles espalhados.
- **Fluxo desejado:**
  1. Foca a barra → digita (ex. “pri”, “salva”, “sertão”, nome de assessor).
  2. Vê sugestões agrupadas por dimensão (Prioritária, Município, Território, Assessor, …).
  3. Escolhe uma sugestão → vira chip dentro do input; lista atualiza; pode digitar o próximo termo à direita dos chips.
  4. Remove um chip com um clique (ou backspace no chip focado) → aquele filtro some; demais permanecem.
  5. “Limpar” (ou equivalente) zera todos os chips de uma vez.
- **Anti-goals de produto:** segunda toolbar ao lado da omnibox; spreadsheet mode; inventar dimensões novas de filtro neste item; redesign do shell/sidebar; sync multi-device dos bookmarks B18.

### Esboço de fluxo (C)

```text
[lista aberta]
    → foca barra vazia
    → digita texto
    → vê sugestões (dimensão + valor)
    → escolhe → chip no input + lista filtrada
    → digita à direita dos chips → outro filtro
    → clica × no chip → remove só aquele
    → outcome: recorte legível na barra, lista coerente, sem selects empilhados
```

## Objetivo e aceite

- Em **todas as proporções de tela**, a entrada primária de filtro da lista piloto é **uma** barra omnibox (chips + caret + sugestões), não a pilha atual (busca + cenário + “Ordenado por” + selects mobile).
- Digitar sugere filtros (e controles de apresentação: cenário, ordenação) a partir do texto; escolher aplica; chip removível desfaz só aquela dimensão/valor.
- Semântica de cada variante respeita o mapa de produto (inclusivo OR vs exclusivo vs texto livre) — sem mudar o significado do recorte só porque a UI mudou.
- Removidos da barra (piloto Municípios): campo de busca separado, seletor solto de **Cenário**, texto **“Ordenado por …”**, e os seletores/comboboxes empilhados do mobile que duplicam o que a omnibox cobre. Cenário e ordenação passam a viver **como chips/sugestões na omnibox**.
- Texto livre confirmado vira chip **“Busca: …”** (removível); digitação continua à direita dos chips.
- Header filters no desktop **permanecem** como atalho secundário: escolher no header **adiciona/atualiza o chip** na omnibox (mesma fonte de verdade — tipicamente a URL do recorte — então as duas UIs ficam sincronizadas).
- Liderança continua fora destas listas (lockdown inalterado).
- Contrato de URL das listas (B18 / sistema de listas) permanece a fonte do recorte de filtro/sort; a omnibox (e os header filters) editam o mesmo estado. Cenário continua sendo controle de **apresentação** (não filtra linhas); mesmo assim entra na omnibox por simplicidade de UX — default **central (médio)** quando não houver cenário selecionado.

## Dados (intenção)

- **Vou apresentar dados?** Não — este item só muda **como** o staff monta o recorte sobre dados que a lista já mostra.
- **Decisões desbloqueadas:** CG/Assessor — “quais linhas entram neste recorte agora?” com menos atrito de UI.
- **Forma:** *adiada ao plano de implementação* — restrição de produto: a barra comunica o recorte ativo (chips legíveis), não esconde filtros “mágicos” sem affordance de remoção.

## Mapa de variantes de filtro (produto)

Legenda de comportamento:

| Comportamento | Significado |
| ------------- | ----------- |
| **Texto (`q`)** | Busca livre; sem termo = sem restrição de texto. |
| **Inclusivo (OR)** | Um ou mais valores da mesma dimensão; linha entra se casar **qualquer** valor; **dimensão ausente = todas as linhas** nessa dimensão. |
| **Exclusivo** | No máximo um valor; ausente = todas; escolher outro substitui (ou re-escolher limpa, conforme UX atual). |
| **Único (select)** | Um valor ou vazio (= todas). |
| **Preset de aba** | Aba define janela/status; não é chip de filtro livre (pode coexistir fora da omnibox). |

### `/campanha/municipios` (piloto)

| Variante (rótulo sugerido) | Comportamento | Notas de produto |
| -------------------------- | ------------- | ---------------- |
| Busca / texto | Texto (`q`) | Nome contém; zona numérica quando fizer sentido. Confirmado → chip **“Busca: …”**; sem chip de busca = sem restrição de texto. |
| Prioritária | Exclusivo | Só municípios marcados prioritários; ausente = todos. |
| Município | Inclusivo (OR) | Lista de slugs; ausente = todos os municípios do escopo. |
| Território | Inclusivo (OR) | Territórios de identidade. |
| Classe | Inclusivo (OR) | Classes territoriais relativas. |
| Nível | Inclusivo (OR) | Inclui “Sem nível”. |
| Assessor | Inclusivo (OR) | Assessores nomeados. |
| Assessoria (com/sem) | Exclusivo | Cobertura de assessoria; mutuamente exclusivo com “sem filtro de cobertura”. |
| Tendência | Inclusivo (OR) | Valores de tendência. |
| Cenário (estimativa) | Chip de **apresentação** (não filtra linhas) | Valores pessimista / central / otimista. Ausente ou removido → **central (médio)**. Digitar “cenário” (ou equivalente) sugere as opções. Não entra no bookmark B18. |
| Ordenação | Chip / sugestão de apresentação | Digitar “ordenar” sugere as opções de sort da lista; escolher aplica `sort`/`dir` (mesma fonte que o clique no header). Some o rótulo solto “Ordenado por …”. |
| Filtros salvos (B18) | Bookmark de href | Ver Questão 5 — distinto dos chips do recorte **atual**. |

### `/campanha/territorios`

| Variante | Comportamento |
| -------- | ------------- |
| Busca / texto | Texto (`q`) |
| Território | Inclusivo (OR) |
| Assessoria (com/sem) | Exclusivo |
| Ordenação | Chip / sugestão (“ordenar …”) — mesma regra do piloto |

### `/campanha/liderancas`

| Variante | Comportamento |
| -------- | ------------- |
| Busca / texto | Texto (`q`) |
| Status | Inclusivo (OR) |
| Município | Inclusivo (OR) |
| Acesso ao app | Exclusivo (`com` / `sem`) |
| Ordenação | Chip / sugestão (“ordenar …”) — mesma regra do piloto |

### `/campanha/dobradinhas`

| Variante | Comportamento |
| -------- | ------------- |
| Busca / texto | Texto (`q`) |
| Partido | Inclusivo (OR) (incl. “sem partido”) |
| Ordenação | Chip / sugestão (“ordenar …”) — mesma regra do piloto |

### `/campanha/apoiadores`

| Variante | Comportamento |
| -------- | ------------- |
| Busca / texto | Texto (`q`) |
| Intenção de voto | Único |
| Cidade | Único |
| Município | Único |

### `/campanha/atividades`

| Variante | Comportamento |
| -------- | ------------- |
| Aba (Próximos / Todos / …) | Preset de aba — **fora** da omnibox (navegação de modo) |
| Tipo | Único |
| Status | Único (só quando a aba permitir) |
| Município | Único |
| Busca | Hoje inexistente — **não inventar** neste lote salvo pedido explícito |

### `/campanha/demandas`

| Variante | Comportamento |
| -------- | ------------- |
| Status | Exclusivo (hoje chips “Todas” + status) — candidato a chips/omnibox na adoção |
| Tipo / atividade | Existem na URL sem UI de lista — **não inventar** superfície nova neste lote |

### `/campanha/organizacoes` · `/campanha/assessores`

| Variante | Comportamento |
| -------- | ------------- |
| Busca / texto | Texto (`q`) — omnibox degenera para “só busca + chips se no futuro houver dimensão” |
| Demais | Sem dimensões de filtro expostas hoje |

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shared/` (shells de lista: `CampaignSearchForm`, `CampaignFilterChips`, mobile multi-filter, header filter popover), `src/components/campaign/municipality/MunicipalityFilters.tsx` (piloto), parsers/URL por domínio em `src/utilities/<domínio>/`, saved filters B18 (`municipalitySavedFilters`, nav sidebar).
- **Precedente a olhar:** sistema de listas (Pass 2 W1), B18 filtros salvos, B120 combobox mobile municípios, header filters B16 — a omnibox **substitui** a pilha de controles, não cria um terceiro caminho paralelo.
- **Risco de acoplamento:** contrato de URL congelado (B18 / list query match); sidebar de filtros salvos não pode importar serializador pesado do domínio; leader lockdown; cenário **não** entra no href salvo.

## Dependências

- Nenhuma dura. Soft: B18 ✓ (bookmarks Municípios), sistema de listas ✓.
- **B128** (adoção nas demais listas) depende deste item.

## Fora de escopo

- Adoção completa nas outras listas → **B128**.
- Mover bookmarks B18 para dentro da omnibox (sidebar permanece, salvo decisão contrária nas Questões).
- Novas dimensões de filtro / expor `kind` de organizações ou deep-links de demandas.
- Sync servidor / compartilhar recorte entre dispositivos.
- Redesign do mapa do Início / filtros do mapa.
- Impeccable craft formal além do encaixe C na execução.

## Rabbit holes de produto

- **Virar command palette global.** Se alguém “só completar”: mistura busca global do Início com filtro de lista. **Corte:** escopo = filtrar a lista corrente; navegação global fica onde já está.
- **Generalizar saved views para todas as listas.** **Corte:** chips = estado ativo; B18 continua só Municípios até pedido explícito.
- **Duplicar estado entre omnibox e header filters.** **Corte:** uma fonte de verdade (URL do recorte); as duas UIs só espelham — header aplica → chip aparece; chip some → header reflete.

## Questões em aberto (produto)

- ~~Cenário / ordenação / busca-chip / header filters / B18~~ — **decidido (2026-08-02):**
  1. Cenário **entra** na omnibox (não filtra linhas; default **central/médio** se ausente).
  2. Digitar “ordenar” sugere opções de sort na omnibox.
  3. Texto livre → chip **“Busca: …”**.
  4. Header filters **permanecem**; ao usar, sincronizam chips via mesma fonte de verdade (URL do recorte).
  5. Bookmarks B18: **A** — sidebar permanece como está; omnibox não sugere/substitui salvos neste lote.

## Referências

- GitHub Issue [#264](https://github.com/fsolla/teqo/issues/264)
- Inventário atual: Municípios / Territórios / Lideranças / Dobradinhas / Apoiadores / Atividades / Demandas / Organizações / Assessores
- `docs/plans/filtros-salvos-municipios.md` (B18)
- `docs/plans/sistema-listas-campanha.md`
- `docs/plans/cenario-junto-filtros-municipios.md`
- `docs/plans/adotar-barra-filtros-omnibox-listas.md` (B128)
- `src/components/campaign/municipality/MunicipalityFilters.tsx`
- `src/components/campaign/shared/CampaignHeaderFilterPopover.tsx`
- `AGENTS.md` — sistema de listas / URL congelada / saved filters só Municípios
