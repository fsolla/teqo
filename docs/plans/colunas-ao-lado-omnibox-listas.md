# B137 — Colunas ao lado da omnibox (e fim do “Ordenado por …” residual)

Status: registrado
Atualizado em: 2026-08-02
Issue: #304
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na barra de lista já existente (omnibox + picker)
Appetite: ~0,5–1 dia eng; um outcome verificável em todas as listas com seletor de colunas
Responsável: —

## Intenção

Depois da omnibox (B127/B128), o botão **Colunas** ainda aparece **abaixo** da barra de filtros — entre a omnibox e a tabela. Isso quebra a leitura vertical: o staff espera a lista logo sob o recorte, e o picker parece “mais um bloco” da pilha antiga.

Nas listas que ainda mostram o texto **“Ordenado por …”** (Territórios, Lideranças, Dobradinhas), o mesmo problema se agrava: uma linha de status de ordenação compete com a omnibox, onde a ordenação já vive como chip/sugestão.

Queremos a barra de filtro **direto acima** dos dados, com **Colunas** ao lado da omnibox (não embaixo), e o span visível de ordenação **fora** dessas telas.

## Persona e fluxo

- **Persona / contexto:** CG / Assessor / Candidato na mesa, varrendo Municípios, Demandas, Apoiadores, Territórios, Lideranças ou Dobradinhas.
- **Job principal:** recortar a lista e (quando útil) esconder colunas, sem um degrau visual entre filtro e dados.
- **Fluxo desejado:**
  1. Abre a lista → vê omnibox (e, no desktop onde o picker existe, **Colunas** na mesma fileira).
  2. Imediatamente abaixo: tabela/cards — sem “Ordenado por …” nem picker empilhado.
  3. Ajusta filtros na omnibox; opcionalmente abre Colunas; a lista responde sob a barra.
- **Anti-goals de produto:** segunda toolbar de filtros; redesign do shell; mudar o que o picker grava/persiste; spreadsheet mode; tirar ordenação da omnibox/header (só some o rótulo solto).

### Esboço de fluxo (B)

```text
[abre lista]
  → fileira: [omnibox ………………] [Colunas]
  → lista/dados logo abaixo
  → (sem linha “Ordenado por …”)
  → outcome: recorte + densidade na mesma altura; dados sob o filtro
```

## Objetivo e aceite

- Em **/campanha/municipios**, **/campanha/demandas**, **/campanha/apoiadores**, **/campanha/territorios**, **/campanha/liderancas**, **/campanha/dobradinhas** (e demais listas que já expõem o seletor via o mesmo chassis — ver Questões): o botão **Colunas** fica **ao lado** da omnibox, não abaixo dela.
- A omnibox fica **diretamente acima** da região de dados (tabela/cards); nenhum controle de colunas ou caption de sort visível entre os dois.
- Em **/campanha/territorios**, **/campanha/liderancas**, **/campanha/dobradinhas**: o span/parágrafo visível **“Ordenado por …”** some por completo. Ordenação continua disponível via omnibox (chip/sugestão) e/ou clique no header — sem perder a capacidade, só o rótulo solto.
- Caption `sr-only` / acessível da tabela pode continuar a citar a ordenação se fizer sentido para leitores de tela — o que some é o texto **visível** entre barra e lista.
- Comportamento do seletor (o que esconde, persistência, mandatory) e contrato de URL das listas permanecem; este item é chrome de layout + limpeza do residual pós-omnibox.
- Liderança lockdown inalterado (essas listas já são staff / noLeader).

## Dados (intenção)

- **Vou apresentar dados?** Não — **Dados: N/A**. Só reposiciona um controle de viewport e remove um rótulo de status.
- **Decisões desbloqueadas:** nenhuma decisão de campanha nova; reduz atrito ao usar o recorte já existente.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: Colunas é controle de **apresentação** ao lado da barra de filtro, não um filtro nem uma segunda fileira de chips.

## Direção no codebase (hipótese)

- **Áreas prováveis:** chassis `CampaignTable` / `CampaignColumnPicker` (hoje o picker renderiza acima da tabela); `CampaignListOmnibox` (`trailing` já existe — Municípios usa para salvar filtro); filtros por domínio (`*Filters.tsx`); páginas/listas que ainda montam `<p>…{sortSummary}</p>` (Territórios / Lideranças / Dobradinhas); helpers `format*ListSortSummary` (podem permanecer para caption acessível).
- **Precedente a olhar:** B17 (seletor de colunas), B127/B128 (omnibox; Municípios já tirou o “Ordenado por …” visível), `trailing` da omnibox.
- **Risco de acoplamento:** não inventar um segundo picker; não quebrar o gate `md:` onde tabela some em favor de cards (municípios/apoiadores); manter B18 / URL de lista intactos.

## Dependências

- Soft: B127 / B128 (já entregues) — este item completa a limpeza de chrome que a omnibox começou.
- Nenhuma dependência dura aberta.

## Fora de escopo

- Reordenar colunas (DnD) — plano antigo rejeitado / outro job.
- Dar picker mobile às listas que só têm tabela em qualquer largura (lacuna B17) — só se couber sem inflar appetite; default fora.
- Mudar semântica de sort/filtro ou chips da omnibox.
- Redesign de empty states, footers ou FABs “Nova …”.
- Listas sem seletor de colunas hoje (ex. atividades em cards, assessores se ainda fora do `CampaignTable`).

## Rabbit holes de produto

- **“Já que estamos na barra, meter Cenário / Export / densidades.”** Corte: só Colunas + remover “Ordenado por …” residual.
- **Esconder ordenação também do header / omnibox.** Corte: some o span solto; sort continua.
- **Forçar Colunas dentro do campo da omnibox (como chip).** Corte: ao lado (fileira), não dentro do input — não é dimensão de filtro.

## Questões em aberto (produto)

- **Incluir `/campanha/organizacoes` (e qualquer outra lista que já tem Colunas via o mesmo chassis)?** **Opções:** A) só as seis rotas citadas; B) todas as listas que já expõem o picker, para o chrome ficar uniforme. **Decisão (gate 2026-08-02):** B.
- **No mobile (onde o picker hoje some em municípios/apoiadores):** **Opções:** A) manter hidden abaixo de `md` (status quo B17); B) mostrar Colunas ao lado da omnibox também no estreito. **Decisão (gate 2026-08-02):** A — não reabrir a lacuna mobile do B17.
- **Sort na omnibox/header permanece; some só o span solto “Ordenado por …”?** **Decisão (gate 2026-08-02):** sim.

## Referências

- GitHub Issue #304
- `docs/plans/seletor-colunas-lista-municipios.md` (B17)
- `docs/plans/barra-filtros-omnibox-listas.md` (B127) / `docs/plans/adotar-barra-filtros-omnibox-listas.md` (B128)
- Rotas: `/campanha/municipios`, `/demandas`, `/apoiadores`, `/territorios`, `/liderancas`, `/dobradinhas` (+ `/organizacoes` se B)
- Chassis: `src/components/campaign/shared/CampaignTable.tsx`, `CampaignColumnPicker.tsx`, `CampaignListOmnibox.tsx`
