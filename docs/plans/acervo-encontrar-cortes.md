# Acervo: encontrar cortes — na navegação, na fala e na busca

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1084
Priority: P2
Impeccable: C — fluxo/chrome novo na vertical Comunicação (nav + seção na fala + resultados de busca)
Design UI: docs/plans/acervo-encontrar-cortes-ui-design.html
Appetite: ~1,5–2 dias eng; um outcome verificável — a assessoria reencontra um corte existente (pela navegação, pela fala de origem ou pela busca) e o reaproveita, sem duplicar.
Responsável: —

## Intenção

Quatro pedidos da assessoria são o mesmo job: **achar e reaproveitar um corte que já existe**. Uma tentativa anterior (C168/#1015) chegou a merged no repo, mas o dono testou o ambiente e **não encontrou a edição** — o que está de pé precisa ser conferido e o fluxo, tornado achável. Hoje, na prática, só se chega à biblioteca por um botão dentro do Acervo de falas, e nada na página da fala lembra que já se cortou dali, então a pessoa refaz o corte. Na busca do acervo, cortes simplesmente não existem. Esta entrega coloca os cortes no caminho: um subitem na navegação de "Comunicação", uma seção "Cortes desta fala" no detalhe da fala e os cortes aparecendo na busca do acervo. É descoberta e reuso; nada de novo modelo de dados.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, mais `coordinator`/`candidate`) na mesa, correndo para publicar; muitas vezes dias depois do corte ter sido feito por outra pessoa.
- **Job principal:** em uma tela, saber se aquela fala ou tema já rendeu corte e abrir para reusar/editar — sem recortar de novo.
- **Fluxo desejado:** abre "Comunicação" na barra, vê "Acervo de falas" e "Biblioteca de cortes"; busca um tema, vê a fala e, aninhado, os cortes já feitos dela; abre a fala e ali há a lista dos cortes com status e link; abre qualquer corte e edita/reusa.
- **Anti-goals de produto:** não criar um segundo cadastro de corte nem uma segunda lista concorrente com a busca; não virar editor de fala; não expor internals de corte em superfície pública.

### Esboço de fluxo (C)

```text
[Comunicação] ──┬─→ [Acervo de falas] ─→ [busca "reforma tributária"]
                │                             └─ [fala + cortes aninhados] ─→ [corte: editar/reusar]
                └─→ [Biblioteca de cortes] ─→ [lista completa] ─→ [detalhe: editar/reusar/share]

[fala (detalhe)] ─→ seção "Cortes desta fala" ─┬─→ [corte existe] ─→ [abrir na biblioteca]
                                               └─→ [vazio] ─→ [Selecionar trecho] (C166/C167)
```

### Design UI (C)

- Design UI (gate): `docs/plans/acervo-encontrar-cortes-ui-design.html`

## Objetivo e aceite

- "Comunicação" ganha subitens visíveis: **Acervo de falas** e **Biblioteca de cortes** — a biblioteca e a edição ficam a um clique de qualquer lugar da vertical.
- O detalhe da fala mostra os cortes já feitos **daquela** fala (título, status, duração, link para o detalhe do corte), com vazio honesto quando não há.
- A busca do acervo mostra os cortes como **subitens da fala de origem** no resultado; cortes não viram uma lista paralela e confusa.
- **Guardrails:** gate é `speechCatalog` (communicator/coordinator/candidate); `advisor`/`leader` negados fail-closed, sem regressão em nada do C168.
- Corte sempre pertence a uma fala; a fala pode ter sido excluída (FK `SET NULL`) e a UI degrada sem quebrar.
- Nenhum internals de corte (media/status cru/erro) vaza; `/corte/<id>` público intocado.
- Sem collection nova, sem `Consent`, sem migration.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item: **uma lista paginada** (a biblioteca de cortes, já do C168) e **um resultado de busca** (cortes aninhados no acervo de falas). **Sem KPI agregado** — não há decisão que peça contagem/gráfico de cortes.
- **Decisões desbloqueadas:** assessoria escolhe _reusar/editar_ vs _cortar de novo_ ao ver o corte existente na fala; escolhe _abrir a biblioteca_ vs seguir navegando ao vê-la no chrome.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrição de produto: contagem honesta na lista ("N cortes"), sem percentual/taxa.

## Dados da decisão (literais)

- Rotas: acervo `/campanha/comunicacao/acervo`; biblioteca `/campanha/comunicacao/acervo/cortes`; detalhe do corte `/campanha/comunicacao/acervo/cortes/[id]`; detalhe da fala `/campanha/comunicacao/acervo/[id]`; pública `/corte/<id>` **intocada**.
- Rótulos de nav (pt-BR): pai **"Comunicação"**; subitens **"Acervo de falas"** e **"Biblioteca de cortes"**.
- Regra de aninhamento na busca: o corte aparece **como subitem indentado abaixo do item da fala de origem**, só quando a fala está no resultado e tem ≥1 corte; **não** existe grupo "Cortes" separado no v1.
- Cabeçalho da seção na fala: **"Cortes desta fala"**.
- Vazio na fala sem cortes: título **"Nenhum corte desta fala ainda"**, descrição **"Selecione um trecho no player para criar o primeiro corte."**, CTA **"Selecionar trecho"**.
- Texto da busca do acervo passa a valer também sobre cortes da fala; rótulo segue "Buscar fala por termo".
- Estado de cada corte na fala: badges `Publicado`/`Despublicado`/`Processando`/`Falhou` (mesmos do C168).

## Direção no codebase (hipótese)

- **Áreas prováveis:** nav em `src/components/campaign/shell/nav.ts` (`CampaignNavItem` hoje é plano — precisa de subitens/ativo); caminhos em `src/lib/campaignPaths.ts`; página da fala `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx`; loader novo de cortes-por-fala em `src/utilities/speech/speechPageData.ts` (hoje só lista-tudo/detalhe em `speechCutPageData.ts` e `findSpeechCutForActor` em `speechCutData.ts`); resultado `SpeechResultList`/`speechViewModels.ts`; `src/components/campaign/speech/`.
- **Precedente a olhar:** C154 (nav própria do communicator + gate `speechCatalog`), C168 (biblioteca/detalhe/editora de título), C166/C167 (selecionar trecho/cortar), C170 (teto removido).
- **Risco de acoplamento:** não duplicar a lista de cortes — reusar `loadSpeechCutAcervoPageData`/view models do C168; a busca continua em `speech.searchText` (não criar `searchText` de corte agora); respeitar o lockdown `advisor`/`leader`.

## Dependências

- **C168/#1015** — tentativa anterior (biblioteca, detalhe, edição, kill switch) merged em `main`, mas o dono relata que **não encontra a edição**; validar a superfície no ambiente real antes de assumir que existe e, então, torná-la achável.
- **C154** (entregue) — gate `speechCatalog` e nav do communicator.
- **C166/C167/C170** (entregues) — de onde o corte nasce no detalhe da fala; o CTA de vazio aponta para o fluxo deles (suave).

## Fora de escopo

- Editar título/descrição em si — já é do C168; aqui só se chega à tela.
- Qualquer mudança no contrato público `/corte/<id>` (unlisted, `noindex`, sem transcript).
- Facetas/filtros de corte (ano, fala de origem, status) na biblioteca — C168 é só `q` + paginação.
- Corte em massa / edição em lote / deduplicação automática.
- Busca acento-insensível e índice para corte (gatilho do C168: ~5–10 mil cortes) — vira item próprio se o volume pedir.
- Corte criado de dentro da busca (cortar direto de um resultado).

## Rabbit holes de produto

- **Redesenhar toda a IA do shell.** Se alguém "só completar" a navegação, refaz a sidebar inteira. **Corte neste item:** só a árvore de "Comunicação" ganha subitens; o resto do `nav.ts` fica igual.
- **Editar o corte dentro da fala.** A tentação é editar título/descrição ali mesmo e criar um segundo editor. **Corte neste item:** a fala só **lista e linka**; a edição continua morando no detalhe (C168).
- **Unificar a busca dos dois acervos.** Virar uma query única com `searchText` de corte exige migration/índice. **Corte neste item:** busca continua por fala; corte só aninhado.
- **Segunda lista de cortes.** "Cortes encontrados" como grupo separado recria a duplicação que motivou o pedido. **Corte neste item:** só aninhamento sob a fala.

## Questões em aberto (produto)

- **Corte que casa por título/descrição mas cuja fala não casa?** **Opções:** A (não aparece no v1) | B (traz a fala de origem como bloco-resultado, com o corte aninhado) | C (grupo "Cortes" separado). **Recomendação:** B — mantém uma lista única e ainda responde ao pedido "na busca também apareça cortes". _(assumido — validar com produto)_
- **Nav: subitens expansíveis vs abas na home da Comunicação?** **Opções:** A (subitens no item "Comunicação") | B (tabs). **Recomendação:** A — pedido literal ("subitems dentro de Comunicação") e reaproveita o padrão de nav existente.
- **Manter o botão "Biblioteca de cortes" no topo do acervo?** **Opções:** A (manter como atalho redundante) | B (remover). **Recomendação:** A — custo zero e ajuda quem já tem o reflexo; o subitem é o caminho novo.
- **Status do corte aparece na busca?** **Opções:** A (só título + duração) | B (título + status). **Recomendação:** B — "reaproveitar" pressupõe saber se está publicado; sem custo relevante.

## Referências

- GitHub Issue #1084
- Design UI (gate): `docs/plans/acervo-encontrar-cortes-ui-design.html` (+ `docs/plans/acervo-encontrar-cortes-ui-design-assets/` se houver SVG próprio)
- `docs/changelog/2026-09-15-c168.md` (biblioteca/edição), `docs/changelog/2026-09-13-c154.md` (nav/gate do communicator)
- Rotas/utilitários: `src/components/campaign/shell/nav.ts`, `src/lib/campaignPaths.ts`, `src/utilities/speech/speechCutPageData.ts`, `src/utilities/speech/speechPageData.ts`, `src/utilities/speech/speechCutListUrl.ts`
- `AGENTS.md` — lockdown de papéis de campanha e "edite o dono, não gema um irmão"

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável ("reencontrar e reusar um corte" pelos três caminhos); (2) appetite ~1,5–2 dias, sem schema/migration; (3) persona + job + aceite testáveis; (4) direção no codebase é hipótese (aponta donos sem travar solução); (5) zero decisão dura de engenharia.
