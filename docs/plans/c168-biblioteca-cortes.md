# Acervo: biblioteca de cortes (origem, download, compartilhar, editar título/descrição)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1015
Priority: P2
Impeccable: C — fluxo novo na vertical Comunicação (lista + detalhe de cortes)
Rascunho UI: docs/plans/c168-biblioteca-cortes-ui-draft.html
Appetite: ~1–1,5 dia eng; um outcome verificável — a assessoria reencontra um corte antigo, edita o texto e republica sem refazer o corte
Responsável: —

## Intenção

O corte feito hoje morre no instante em que é enviado: existe para quem recebeu o link e some do radar da assessoria. Reaproveitar um corte antigo — outro formato, outra legenda, o mesmo vídeo — significa refazer o corte do zero (reabrir a fala, achar o trecho, gerar de novo) ou garimpar conversas atrás do link. Este item dá à vertical Comunicação uma biblioteca do que já foi cortado: cada corte guarda o discurso de origem e pode ser reencontrado, ter o texto ajustado, ser baixado, compartilhado e publicado/despublicado sem refazer o vídeo.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) e coordenação/candidatura, na mesa ou no celular, sob prazo de peça; quem não é da vertical (`advisor`, `leader`) segue negado.
- **Job principal:** "reencontrar um corte que eu já fiz, ajustar o texto e republicar — sem refazer o corte".
- **Fluxo desejado:** abre Comunicação → Acervo → Cortes → vê os cortes mais recentes (ou busca por título/descrição) → abre um corte → assiste e confere o discurso de origem → edita título/descrição e salva → baixa, copia o link ou compartilha no WhatsApp → publica/despublica → a página pública reflete o texto e o estado.
- **Anti-goals de produto:** não virar editor de vídeo (nada de trocar início/fim ou re-render); não ser um segundo acervo de falas; sem comentários, versionamento, coleções/kits, favoritos ou métricas; sem deletar pela UI.

### Esboço de fluxo (C)

```text
[lista de cortes: recentes primeiro + busca por título/descrição]
→ abre o detalhe do corte → assiste e confere o discurso de origem (link)
→ edita título/descrição → salva (a página pública reflete)
→ baixa MP4 / copia link / WhatsApp / publica-despublica (kill switch)
→ [outcome: reencontrou, reaproveitou e republicou sem refazer o corte]
```

### Rascunho UI (C)

- Rascunho UI (gate): `docs/plans/c168-biblioteca-cortes-ui-draft.html` — cenas: lista de cortes desktop e vazia; detalhe com player, origem, edição e ações; confirmação de despublicar; mobile.

## Objetivo e aceite

- Existe `/campanha/comunicacao/acervo/cortes`: cortes mais recentes primeiro, cada item com título, discurso de origem (tipo + data, com link para a fala), duração, status (publicado/despublicado) e data de criação; busca por título/descrição e paginação padrão da casa.
- O detalhe do corte mostra o player, o discurso de origem com link e o título/descrição editáveis; salvar reflete na página pública e no preview, sem passo extra.
- No detalhe também se baixa o corte (MP4), copia-se o link e compartilha-se no WhatsApp; o link compartilhado é o mesmo da página pública.
- Publicar/despublicar pela página interna com aviso explícito: despublicado, o link público para de funcionar; o estado aparece na lista.
- **Guardrails de produto:** leem/editam `communicator`, `coordinator` e `candidate`; `advisor` e `leader` ficam de fora (fail-closed). Deletar corte não existe na UI (admin pode). Editar o texto do corte nunca altera a fala original nem o vídeo.

## Dados (intenção)

- **Vou apresentar dados?** Não — recorte operacional de itens existentes (lista paginada); status publicado/despublicado é estado do item, não KPI.
- **Decisões desbloqueadas:** a assessoria escolhe qual corte reaproveitar, o que ajustar no texto e o que manter no ar; nenhuma leitura agregada nova.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: sem métricas de vaidade (views/downloads) nem contadores de acervo.

## Dados da decisão (literais)

- Rotas internas: `/campanha/comunicacao/acervo/cortes` (lista) e `/campanha/comunicacao/acervo/cortes/[id]` (detalhe).
- Acesso: `communicator`, `coordinator` e `candidate` leem e editam título/descrição/publicação; `advisor` e `leader` negados (fail-closed).
- Lista: mais recentes primeiro; cada item mostra título, discurso de origem (tipo + data, com link para a fala), duração, status (publicado/despublicado) e data de criação; busca por título/descrição; paginação padrão da casa.
- Aviso de despublicar (texto de produto): título "Despublicar este corte?" e corpo "O link público deixa de funcionar para quem já recebeu. Você pode publicar de novo quando quiser." — botões "Cancelar" e "Despublicar".
- Vazio da lista: "Nenhum corte ainda" + caminho para o acervo de falas.
- Publicar/despublicar é kill switch: despublicado, o link público para de funcionar; republicar restaura o mesmo link (o corte continua na biblioteca).
- Sem deletar corte pela UI (admin pode); sem comentários, versionamento, coleções/kits ou métricas de vaidade.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rotas em `src/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/` (lista + `[id]`), paths em `src/lib/campaignPaths.ts`, chrome em `src/lib/campaignPageChrome.ts`, componentes na vertical (`src/components/campaign/speech/` ou domínio irmão) e utilitários de leitura/estado ao lado do acervo.
- **Precedente a olhar:** acervo de falas — `acervo/page.tsx` (lista paginada + vazio + footer), `SpeechAcervoFilters.tsx`/`speechListUrl.ts` (busca e estado na URL), `SpeechResultCard.tsx`, `SpeechDetailPlayer.tsx` (player, baixar/abrir fonte) e o detalhe `acervo/[id]/page.tsx`; chrome `campaignPageChrome.ts`; nav do communicator em `src/components/campaign/shell/nav.ts`.
- **Risco de acoplamento:** o `communicator` lê mas não atualiza a fala (`canUpdateSpeech` é de papéis unrestricted) — o texto editável é o do corte, não o da fala; não misturar com o where/ordenação da lista de falas; leader/advisor lockdown e gate `speechCatalog` intocados; a página pública `/corte/<id>` é do C167 (aqui só se reflete).

## Dependências

- **Dura: C167** — sem o corte salvo no servidor e a página pública `/corte/<id>`, não há o que listar, baixar, compartilhar nem publicar/despublicar.
- **Indireta: C166** — seleção de trecho [início,fim] e compartilhamento por link do YouTube: é o passo anterior do fluxo; o compartilhar da biblioteca é o link público do corte, não o link do YouTube.
- Suaves: C154/C153 (acervo de falas, gate e chrome) e a vertical Comunicação.

## Fora de escopo

- Editar o corte (trocar início/fim, re-render, editor de vídeo).
- Deletar/arquivar corte pela UI (admin pode), lixeira e desfazer.
- Comentários, versionamento/histórico, coleções/kits/playlists, favoritos e métricas (views/downloads).
- Qualquer mudança na página pública além de refletir título/descrição/publicação (a superfície é do C167).
- Ações em lote (baixar/publicar/editar vários) e exportação.

## Rabbit holes de produto

- **"Já que tem a lista, deixa ajustar o corte (início/fim)."** Se alguém "só completar": editor/re-render e fila de processamento. **Corte neste item:** só título/descrição/publicação; o vídeo é imutável.
- **"Coleções/kits por tema para organizar."** Se alguém "só completar": segunda taxonomia e curadoria. **Corte neste item:** lista única com busca.
- **"Mostrar views/downloads de cada corte."** Se alguém "só completar": dashboard de vaidade sem decisão nomeável. **Corte neste item:** sem métricas.
- **"Soft delete/desfazer despublicar."** Se alguém "só completar": versionamento e lixeira. **Corte neste item:** kill switch; republicar resolve.
- **"Compartilhar em todas as redes."** Se alguém "só completar": integrações e SDKs. **Corte neste item:** copiar link + WhatsApp (o que o produto pediu).

## Questões em aberto (produto)

- **Aba/segmento na lista do acervo (Falas | Cortes) ou rota separada?** **Opções:** A) rota separada `/acervo/cortes` com link no acervo | B) abas na mesma tela. **Recomendação: A** — recortes, filtros e ordenação diferentes; misturar paginação e estado de URL confunde. _(assumido — validar no gate)_
- **Busca na biblioteca?** **Opções:** A) busca simples por título/descrição | B) sem busca nesta fatia. **Recomendação: A** — é o job do item (reencontrar); barra padrão da casa. _(assumido — validar)_
- **Ordenação?** **Opções:** A) mais recentes primeiro | B) agrupar por discurso de origem. **Recomendação: A** — o corte é a unidade; a origem é contexto do item, com link para a fala.
- **Quem pode editar título/descrição?** **Opções:** A) qualquer um com acesso ao acervo (communicator+) | B) só quem criou + coordenação. **Recomendação:** A — equipe pequena; o kill switch cobre abuso. _(assumido — validar)_
- **Despublicar apaga ou só desativa o link?** **Opções:** A) desativa; republicar restaura o mesmo link | B) apaga o corte público. **Recomendação:** A — reverter é barato e o corte continua na biblioteca.

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c168-biblioteca-cortes-ui-draft.html`
- `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx` · `acervo/[id]/page.tsx` · `src/components/campaign/speech/` (filtros, card, player) · `src/utilities/speech/speechListUrl.ts`/`speechPageData.ts`
- `src/lib/campaignPageChrome.ts` · `src/lib/campaignPaths.ts` · `src/utilities/campaignPageActor.ts` (gate `speechCatalog`) · `src/utilities/access/speeches.ts` · `src/components/campaign/shell/nav.ts`
- `tests/int/speechCatalog.int.spec.ts` · e2e `campaignSpeechAcervo`
- `AGENTS.md` — vertical Comunicação, leader lockdown, naming/i18n

## Self-score (shaping)

5/5 — (1) fatia com um outcome verificável: reencontrar/editar/republicar um corte sem refazer o corte; (2) appetite ~1–1,5 dia declarado e o escopo cabe (reuso do acervo, sem editor nem taxonomia nova); (3) persona, job e aceite em linguagem de usuário; (4) direção no codebase é hipótese com precedente nomeado, sem contrato; (5) zero decisão dura de engenharia (sem schema/collection/migration/signature).
