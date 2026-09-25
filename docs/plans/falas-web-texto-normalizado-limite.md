# Falas longas entram no acervo sem estourar o limite do texto normalizado

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1337
Priority: P1
Impeccable: A — N/A
Design UI: N/A
Appetite: ~0,5 dia; um outcome verificável (fala longa entra e continua pesquisável)
Responsável: —

## Intenção

Na última rodada de ingestão web (`pnpm falas-web:import`, C215/C218), as quatro falas mais longas do lote — justamente podcasts, programas de rádio e plenárias — não entraram no acervo: o import falhou no estágio `media` porque o texto normalizado de busca estourou o limite de 40 000 caracteres do Payload. A transcrição (ASR) já tinha sido paga e o operador só descobre o problema no relatório, depois do custo. O dono quer que uma fala de qualquer duração entre no catálogo e continue pesquisável do começo ao fim — perder acervo por tamanho de transcrição não é aceitável.

## Persona e fluxo

- **Persona / contexto:** operador do acervo (comunicação/gabinete) rodando a rodada web na mesa; dispara o lote e confere o relatório no fim, sem acompanhar item a item.
- **Job principal:** garantir que toda fala transcrita entre no acervo e siga encontrável por qualquer termo dito.
- **Fluxo desejado:** dispara o lote → o import cria a fala e seus segmentos → a fala longa aparece no acervo → busca por um termo do fim da transcrição devolve a fala → relatório do lote não lista falha de validação.
- **Anti-goals de produto:** não virar pipeline de truncamento silencioso; não redesenhar busca/facetas (C192/C153/C154); não criar segundo lugar de transcrição nem tela nova. Correção de ingestão, não feature.

## Objetivo e aceite

- Importar uma fala de ~3h entra no acervo e aparece na busca por termos do fim da transcrição.
- O relatório do import não reporta falha de validação para falas longas.
- As 4 falas que ficaram pendentes podem ser reingeridas com o mesmo lote e entram (retry idempotente).
- **Guardrail:** nenhuma fala pode ser rejeitada por tamanho de transcrição; a busca textual funciona para o texto inteiro.
- **Guardrail:** sem perda silenciosa — qualquer limite remanescente aparece de forma honesta no relatório; nunca truncar sem registro.
- **Guardrail:** não mudar o comportamento de busca/facetas já entregue (C192/C153/C154) nem o contrato público.

## Dados (intenção)

- **Vou apresentar dados?** Não — é correção de ingestão; o relatório do lote (C215/C218) já existe e continua sendo a superfície de verificação.
- **Decisões desbloqueadas:** operador do acervo — confiar que o lote web entrou completo, sem caçar falha de validação em fala longa.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: a busca precisa cobrir o texto inteiro, sem corte silencioso.

## Dados da decisão (literais)

- Limite que causa a falha: `defaultMaxTextLength = 40000` do Payload, aplicado a `text`/`textarea` sem `maxLength` próprio (`node_modules/payload/dist/config/defaults.js:48`; `node_modules/payload/dist/fields/validations.js:24`). `src/payload.config.ts` não sobrescreve esse default.
- Campos irmãos sob o mesmo teto, todos com label `Texto normalizado (busca)`: `Speech.searchText`, `SpeechSegment.searchText`, `Recording.searchText`, `RecordingSegment.searchText`, `ContentPiece.searchText`.
- Mensagem literal da falha: `O campo a seguir está inválido: Texto normalizado (busca)`.
- Lote da evidência: 4 itens falharam no estágio `media` — 6394s, 10187s, 3528s e 4052s de duração; relatório `data/falas-web/reports/falas-web-2026-09-25T02-18-30-484Z.json` (gitignored; registro da sessão).
- A coluna no Postgres é `character varying` sem limite (`information_schema.columns`) — é validação de aplicação, sem migration envolvida.
- Caminho de escrita compartilhado Câmara/web: `upsertSpeechBundle` em `src/utilities/speech/speechImport.ts`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/Speech.ts` (campo `searchText`, ~233–248) e irmãos `SpeechSegment.ts`, `Recording.ts`, `RecordingSegment.ts`, `ContentPiece.ts`; `src/payload.config.ts`; `src/utilities/speech/speechImport.ts`.
- **Precedente a olhar:** C154 (searchText denormalizado por fala), C215/C218 (ingestão web e relatório), índice GIN trigram hand-written.
- **Risco de acoplamento:** a busca lê `searchText` com LIKE/contains e o índice GIN é escrito à mão — a correção não pode degradar C192/C153/C154 nem o contrato de URL pública.

## Dependências

- Nenhuma.

## Fora de escopo

- Reindexação/limpeza de dados históricos: a falha impedia a criação, então não há fala parcial no acervo — só o retry do lote pendente.
- Trocar a estratégia de `searchText` (ex.: buscar direto nos segmentos) — fica para item próprio, se algum dia for desejado.
- Mudanças em busca, facetas ou listagem (C192/C153/C154).
- Limite de exibição da transcrição na página da fala (não é o campo de busca).
- Custo de ASR e re-transcrição: nada a fazer; a transcrição já existe.

## Rabbit holes de produto

- **“Só subir o default global e pronto”.** Se alguém “só completar”: o teto vira decisão única para todo o admin e mascara limites de outros domínios. **Corte neste item:** a escolha do mecanismo é do plano de implementação (ver Questões em aberto), com a restrição de não truncar o texto de busca.
- **“Truncar em 40 000 com registro no relatório”.** Se alguém “só completar”: atende o relatório, mas quebra o aceite de achar termos do fim da transcrição e perde acervo pesquisável. **Corte neste item:** busca no texto inteiro é obrigatória; registro honesto é piso, não solução.
- **“Redesenhar a busca para varrer segmentos”.** Se alguém “só completar”: explode para redesign de C153/C154 e do índice. **Corte neste item:** manter o contrato entregue.

## Questões em aberto (produto)

- **Qual mecanismo garante o texto inteiro?** **Opções:** A) elevar o teto global (`defaultMaxTextLength`); B) `maxLength` explícito nos campos de texto normalizado; C) truncar com registro no relatório. **Recomendação:** A ou B — qualquer uma que preserve o texto inteiro e a busca ponta a ponta; C não atende o aceite. A escolha fina é do plano de implementação, com a evidência de que a coluna não tem limite. _(assumido — validar com produto)_
- **Se algum limite remanescente existir, como o relatório o mostra?** **Opções:** A) manter a falha de validação visível; B) registrar contagem de caracteres e motivo do corte. **Recomendação:** A como estado atual seguro; B só se houver limite inevitável — nunca truncar sem linha no relatório. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1337 (C223)
- Design UI (gate): N/A
- `docs/plans/acervo-falas-web-ingestao.md` e `acervo-falas-web-ingestao-impl.md` (C215/C218); `docs/plans/catalogo-falas-solla.md`
- Abrir primeiro: `src/collections/Speech.ts` (~233–248), `src/utilities/speech/speechImport.ts`, `src/collections/SpeechSegment.ts`, `src/collections/Recording.ts`, `src/collections/RecordingSegment.ts`, `src/collections/ContentPiece.ts`, `src/payload.config.ts`
- Para confirmar o teto: `node_modules/payload/dist/config/defaults.js:48` e `node_modules/payload/dist/fields/validations.js:24`
- `AGENTS.md` — ingestão de falas e convenção de migrations (`push: false`; esta correção, pela evidência da coluna, não deve precisar de migration)
