# Listas `/campanha` — subtítulos curtos (sem prosa; filtro salvo em Municípios)

Status: rascunho
Atualizado em: 2026-08-02
Issue: #283
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no chrome de página (B123) + barra de filtros de Municípios
Appetite: ~0,5–1 dia eng; um outcome verificável (header sem prosa; Municípios com nome do filtro salvo só no subtítulo)
Responsável: —

## Intenção

Depois de B123, título e subtítulo das seções passaram para o header da app. A prosa longa do catálogo (“Os 435 municípios…”, “Compare a concentração…”, etc.) ficou grande demais ao lado do título — o nome da seção já orienta. Em Municípios, ao abrir um filtro salvo, o nome do recorte ainda aparece como label ao lado da barra de busca (ex. “Sem assessor”), duplicando o que deveria ser só orientação no header.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador / assessor / candidato) saltando entre listas; quer a dobra de cima limpa.
- **Job principal:** saber onde está sem ler parágrafo no header; em filtro salvo de Municípios, reconhecer o recorte pelo subtítulo.
- **Fluxo desejado:**
  1. Abre lista citada → header só com o título da seção (sem subtítulo de prosa).
  2. Abre Quadro ou create/edit estático → idem (só título; sem prosa).
  3. Em `/campanha/municipios` sem filtro salvo casado → só “Municípios”.
  4. Casa com um filtro salvo → subtítulo do header = **nome do filtro**; a label ao lado da busca que repetia esse nome **some**.
- **Anti-goals de produto:** redesign do shell; sumir com chips/controles de filtro que ainda são a forma de editar o recorte; inventar subtítulo para URL filtrada que não é filtro salvo; mexer em Organizações / Conceitos / Perfil / Contatos (fora do pedido).

### Esboço de fluxo (B)

```text
[lista / quadro / nova|editar]
  → header: "<Título>"
  → (sem L2 de prosa)

[/campanha/municipios]
  → header: "Municípios"
  → barra: busca + controles (sem label de nome de filtro)

[/campanha/municipios + filtro salvo "Sem assessor"]
  → header: "Municípios" / subtítulo "Sem assessor"
  → barra: sem a label "Sem assessor" ao lado da busca
  → Salvar/Renomear e chips/critérios de filtro (se houver) seguem como controles
```

## Objetivo e aceite

- Remover subtítulo de prosa do chrome nas rotas de **lista**: Municípios (vista geral), Territórios, Lideranças, Dobradinhas, Atividades, Demandas, Apoiadores, Assessores.
- Remover subtítulo de prosa também no **Quadro** e nas rotas **create/edit** estáticas do chrome (ex.: Nova/Editar liderança, atividade, demanda, dobradinha, apoiador, importar CSV, planejar giro, editar município — o que hoje carrega prosa no catálogo/override).
- Em Municípios, quando a URL **casa** com um filtro salvo: subtítulo do header = nome do filtro; quando **não** casa (incluindo filtros ad hoc): **sem** subtítulo.
- Remover a label visível ao lado da barra de busca que hoje mostra o nome/resumo do recorte quando o filtro salvo está ativo (screenshot: “Sem assessor” entre busca e Cenário/Renomear). Não remover o botão Salvar/Renomear nem a affordance de limpar.
- Detalhe de entidade: inalterado (header = seção; corpo mantém nome do registro).
- Fora deste item: listas/telas não citadas acima (Organizações, Conceitos, Perfil, Contatos) e auth/wizard.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** nenhuma de alocação — só orientação espacial.
- **Forma:** _adiada ao plano de implementação_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** catálogo/resolução de chrome em `src/lib/campaignPageChrome.ts` (+ overrides `SetCampaignPageChrome` nas rotas); header `CampaignPageChromeText` / shell; barra de Municípios (`MunicipalityFilters` / omnibox em `main` — a label vista no screenshot é o resumo ao lado da busca, hoje tipicamente `formatMunicipalityActiveFiltersSummary` / equivalente); match de filtro salvo (B18: `useMunicipalitySavedFilters` + `listQueryMatch`).
- **Precedente a olhar:** B123 (`docs/plans/orientacao-shell-sem-titulos-secao.md`, #250); B18 filtros salvos.
- **Risco de acoplamento:** não puxar o serializador pesado de URL de Municípios para o layout inteiro; leader lockdown intocado; não confundir chip de critério editável com a label de nome a remover.

## Dependências

- Soft: B123 entregue (chrome no header já existe).

## Fora de escopo

- Organizações (lista), Conceitos, Perfil, Contatos — subtítulos atuais permanecem até pedido explícito.
- Redesign visual do header além de omitir/substituir subtítulo.
- Sync multi-device de filtros salvos; saved views em outras listas.
- Mudar o comportamento dos chips/omnibox como editor de filtro (só a label de nome/resumo duplicada some no caso do filtro salvo).

## Rabbit holes de produto

- **Apagar todos os chips porque “é o nome do filtro”.** Chips são o recorte editável; o pedido é a label de nome ao lado da busca. **Corte:** só a label duplicada; controles de filtro ficam.
- **Subtítulo = resumo de qualquer URL filtrada.** Isso recria prosa variável no header. **Corte:** só nome de filtro **salvo** casado.
- **Limpar Organizações/Conceitos “já que estamos no catálogo”.** Estica o item sem pedido. **Corte:** só o conjunto confirmado no gate.

## Questões em aberto (produto)

- **URL filtrada sem filtro salvo:** sem subtítulo. **Opções:** A) sem subtítulo · B) resumo dos filtros. **Recomendação:** A. _(confirmado)_
- **Escopo de listas vs “todas as listas”:** só as citadas + Quadro + create/edit. **Recomendação:** A (listas citadas) + remoção em Quadro/create/edit. _(confirmado)_
- **Label ao lado da busca:** é a peça visível entre busca e Cenário/Renomear (ex. “Sem assessor” no filtro salvo homônimo). **Recomendação:** remover no caso de filtro salvo ativo; nome vai ao subtítulo do header. _(confirmado via screenshot)_

## Referências

- GitHub Issue #283
- Screenshot do gate: label “Sem assessor” ao lado da busca com filtro salvo ativo
- `src/lib/campaignPageChrome.ts` — catálogo B123
- `src/components/campaign/municipality/MunicipalityFilters.tsx` / omnibox em `main`
- B18 — `docs/plans/filtros-salvos-municipios.md`
- B123 — `docs/plans/orientacao-shell-sem-titulos-secao.md` (#250)
