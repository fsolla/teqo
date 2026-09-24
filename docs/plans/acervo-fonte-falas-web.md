# C216 — Terceira fonte do acervo: "Falas na internet"

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1292
Priority: P1
Impeccable: C — fluxo novo na vertical `/campanha/comunicacao/acervo` (terceira fonte + detalhe próprio)
Design UI: docs/plans/acervo-fonte-falas-web-ui-design.html
Appetite: ~3–4 dias eng; um outcome verificável — a assessoria alterna para "Falas na internet", busca/filtra como no acervo da Câmara e assiste/baixa a fala encontrada
Responsável: —

## Intenção

O acervo cobre duas coisas: o que a Câmara publica e o que a equipe envia. Falta o que o Solla fala fora disso — YouTube, Instagram, rádios, podcasts — material espalhado, sem transcrição pesquisável e sem lugar único. O C215 descobre e cataloga esse material (download, transcrição e classificação automática); este item é a cara disso no acervo: a terceira fonte "Falas na internet", com a mesma busca e os mesmos filtros do "Falas da Câmara" e um detalhe com player, transcrição clicável, download e link para a origem.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) — e `coordinator`/`candidate` — na mesa garimpando matéria-prima com prazo curto, ou em campo procurando no celular o que o Solla já disse sobre um tema.
- **Job principal:** achar uma fala do Solla publicada na internet sobre um assunto/município, ouvir e baixar o arquivo, e saber de onde ela veio para poder citar.
- **Fluxo desejado:** abre o acervo → alterna para "Falas na internet" → busca (termo ou tema) e filtra (ano, tema, alcance, duração, municípios citados) → resultados com trecho destacado e chip da origem → abre o detalhe → player da mídia espelhada no trecho + transcrição clicável por segmento → "Baixar" e "Abrir na origem" (com plataforma, canal/autor e data).
- **Anti-goals de produto:** não é editor de vídeo nem publicação; não expõe o acervo publicamente; não cria cadastro de pessoa; não busca _dentro_ da internet (a descoberta é do C215); não mistura as fontes numa lista única.

### Esboço de fluxo (C)

```text
[acervo /campanha/comunicacao/acervo] → alternador: "Falas da Câmara" | "Gravações enviadas" | "Falas na internet"
  → busca com destaque + facetas (ano, tema, alcance, duração, municípios) com paridade da Câmara
  → abre o detalhe → player da mídia espelhada + transcrição clicável + "Baixar" + "Abrir na origem"
  → [outcome: a fala da internet achada, assistida e baixada, com a origem identificada]
```

### Design UI (C)

- Design UI (gate): `docs/plans/acervo-fonte-falas-web-ui-design.html` (+ assets em `docs/plans/acervo-fonte-falas-web-ui-design-assets/`) — a produzir pelo designer.
- Por que C: fluxo novo na vertical do acervo (terceira fonte, detalhe próprio com player/link externo e estados), mesmo sem rota de topo nova. Design hi-fi obrigatório no gate e fonte de verdade do port.

## Objetivo e aceite

- O alternador do acervo passa a ter três fontes: "Falas da Câmara" | "Gravações enviadas" | "Falas na internet", com a ativa marcada (`aria-current`) e a troca preservando o contrato de URL da fonte.
- "Falas na internet" tem paridade de busca e filtros com "Falas da Câmara" no que a fonte tiver: busca textual com destaque, `mode=termo|tema` (semântica), ano, tema, alcance, duração, municípios citados, contagem e paginação; a lista mostra o trecho com `<mark>` e a contagem.
- Detalhe da fala: player da mídia espelhada (arquivo privado servido autenticado), transcrição clicável por segmento (clique posiciona o player), "Baixar" o arquivo, "Abrir na origem" e atribuição visível (plataforma + canal/autor + data).
- Lista com chip da origem ("YouTube", "Rádio", …) e capa: thumbnail da origem quando a ingestão a capturar; senão, placeholder.
- Estados: vazio (sem resultado), carregando e sem permissão; **sem** estado de processamento por item — a lista mostra o que está pronto e as falhas ficam no relatório da ingestão (C215).
- Acesso: mesmo gate fail-closed do acervo (`communicator` + `coordinator`/`candidate`; `advisor`/`leader` negados); a mídia nunca é pública.
- Mobile utilizável (a assessoria trabalha em campo).
- **Guardrail de direitos de mídia (decisão assumida):** o dono instruiu, verbatim, "Você não deve se preocupar com direitos da mídia, faça o que for necessário para viabilizar a análise e download das mídias que forem encontradas para alimentar esta sessão e para viabilizar as funcionalidades pedidas." Isto supersede a anotação "nunca mídia de terceiro" de C212/C211-FOLLOWUP-OEMBED e vale como premissa do C215; **confirmado no gate (2026-09-24)** — risco assumido.

## Dados (intenção)

- **Vou apresentar dados?** N/A — resultados de busca não são métrica nem agregado; não desbloqueiam decisão numérica.
- **Decisões desbloqueadas:** N/A — a escolha da persona ("qual fala usar") é qualitativa.
- **Forma:** N/A — restrição de produto: nenhum score de relevância/similaridade exposto como número.

## Dados da decisão (literais)

- **Rótulo da fonte:** "Falas na internet" (terceira opção do alternador, ao lado de "Falas da Câmara" e "Gravações enviadas").
- **Faceta de origem na lista:** chip com a plataforma ("YouTube", "Rádio", "Instagram", …) — vocabulário exato vem do C215.
- **Ações do detalhe:** "Baixar" (arquivo) · "Abrir na origem" (link para o vídeo/post/áudio original) · transcrição clicável.
- **Atribuição/identificação da origem:** plataforma + canal/autor + data.
- **Parâmetro de URL da fonte:** valor decidido na implementação seguindo o padrão `?source=<valor>` do C199 (sem quebrar o contrato congelado da Câmara, `speechListUrl`). _(adiado à implementação)_
- **Estados:** vazio (sem resultado) · carregando · sem permissão; sem estado de processamento por item nesta fase.
- **Acesso:** mesmo gate do acervo, fail-closed (`canReadCommunicationCatalog`/`communicationCatalog`); mídia nunca pública.
- **Dependência dura:** C215 (ingestão: descoberta, download, transcrição, classificação).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/comunicacao/acervo/` (página + sub-rota de detalhe), `src/components/campaign/recording/AcervoSourceToggle.tsx` (terceira opção), `src/utilities/recordings/recordingListUrl.ts` (gêmeo do contrato da nova fonte; hoje `parseAcervoSource` é binário fail-closed), `src/components/campaign/speech/` (`SpeechAcervoFilters.tsx`, lista/card, player), `src/utilities/speech/` (`speechListUrl.ts`, `speechPageData.ts`, `speechViewModels.ts`), `src/utilities/privateMedia/privateMediaResponse.ts` (precedente de servir arquivo privado).
- **Precedente a olhar:** C199 (segunda fonte + contrato de URL próprio no `?source=enviadas`), C192 (`mode=termo|tema`), `gravacoes/[id]/arquivo`, C200 (faceta nova como recorte na mesma tela).
- **Risco de acoplamento:** (1) o contrato da lista da Câmara (`q|mode|year|topic|scope|phase|municipality|duration|page`) está congelado — a fonte nova tem o dele (como o C199 fez), sem renomear params existentes; (2) o detalhe da Câmara é acoplado (VOD da Câmara, `SpeechDetailPlayer`) — a fonte web não tem VOD, o player é da mídia espelhada; (3) o regex genérico de detalhe do chrome (`src/lib/campaignPageChrome.ts`) já mordeu `cortes`/`gravacoes` — escolher rota que não colida; (4) nav de Comunicação pinada (4 itens) e C184/#1106 mexem nela — nada de item de nav novo.

## Dependências

- **C215 (dura):** sem o catálogo (mídia espelhada + transcrição + classificação) não há o que listar; o desenho pode ser validado antes com dados de amostra.
- **C153/C154/C199 (entregues):** base do acervo e alternador de fonte.
- **C184/#1106 (soft):** conflito de nav/chrome — serializar.
- **C217/C218 (futuros):** cortes e skill de atualização; não bloqueiam.

## Fora de escopo

- Ingestão/descoberta, download, transcrição e classificação (C215).
- Cortes e links compartilháveis (C217); skill de atualização (C218).
- Paridade das gravações (C219).
- Diarização, edição de transcrição, publicação externa.
- Merge das fontes numa busca global única; item novo de nav.

## Rabbit holes de produto

- **Merge multi-fonte numa lista única.** Se alguém "só completar": ranking entre fontes, dedupe, busca global. **Corte neste item:** alternador dentro do acervo.
- **Segundo cadastro de pessoa.** Se alguém "só completar": transformar canal/autor em `Contact`. **Corte neste item:** atribuição é texto de origem.
- **Editor de vídeo.** Se alguém "só completar": cortar/legendar/remixar. **Corte neste item:** player + transcrição + download; corte é o C217.
- **Dashboard de vaidade.** Se alguém "só completar": views, alcance, KPIs. **Corte neste item:** sem métrica de audiência.
- **Espelhar tudo em qualidade máxima.** Se alguém "só completar": baixar/guardar versão original de tudo. **Corte neste item:** o que o C215 catalogar; nada de biblioteca de masters.

## Questões em aberto (produto)

- **A fonte entra no mesmo alternador ou em rota separada?** **Opções:** A) terceira opção no mesmo alternador (recomendado) | B) rota separada. **Recomendação:** A — é o mesmo job no mesmo lugar; rota separada fragmenta o acervo. _(confirmado no gate, 2026-09-24)_
- **Capa do card?** **Opções:** A) thumbnail da origem quando a ingestão a capturar; senão placeholder | B) sem capa. **Recomendação:** A — a lista da Câmara já usa imagem e a leitura fica mais rápida; o C215 fornece a thumb. _(confirmado no gate, 2026-09-24)_
- **Mostrar a origem já na lista?** **Opções:** A) sim, chip "YouTube"/"Rádio"/… | B) só no detalhe. **Recomendação:** A — a assessoria escolhe a peça já sabendo de onde a fala veio. _(confirmado no gate, 2026-09-24)_
- **Item sem transcrição (ASR falhou)?** **Opções:** A) fora da lista, só no relatório da ingestão | B) listado com aviso e só link de origem. **Recomendação:** A nesta fase — a fonte web nasce para busca; item sem texto só ruído. _(confirmado no gate, 2026-09-24)_
- **Valor do parâmetro de URL da fonte?** **Opções:** A) decidido na implementação seguindo o padrão `?source=<valor>` do C199 | B) travar agora. **Recomendação:** A — mesma convenção do alternador atual. _(adiado à implementação)_

## Referências

- GitHub Issue — (após `pnpm agent:register`)
- Design UI (gate): `docs/plans/acervo-fonte-falas-web-ui-design.html` (+ assets em `docs/plans/acervo-fonte-falas-web-ui-design-assets/`)
- Planos irmãos: `docs/plans/acervo-gravacoes-enviadas.md` (C199, precedente direto de fonte) · `docs/plans/acervo-videos-comunicacao.md` (C154) · `docs/plans/acervo-separacao-por-pessoa.md` (C200, formato de plano C de acervo) · `docs/plans/acervo-busca-semantica.md` (C192)
- Arquivos-pista: `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx` · `src/components/campaign/recording/AcervoSourceToggle.tsx` · `src/utilities/recordings/recordingListUrl.ts` · `src/components/campaign/speech/` · `src/utilities/speech/speechListUrl.ts` · `src/utilities/speech/speechPageData.ts` · `src/utilities/privateMedia/privateMediaResponse.ts` · `src/lib/campaignPageChrome.ts`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno e leader lockdown
