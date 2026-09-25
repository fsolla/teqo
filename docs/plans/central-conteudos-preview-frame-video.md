# C226 — Central de Conteúdos: frame estático para vídeos com arquivo

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1352
Priority: P2
Impeccable: B — encaixe no slot de mídia já existente do card público, sem rota ou tela nova
Design UI: docs/plans/central-conteudos-preview-frame-video-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável — reconhecer um vídeo com arquivo antes de reproduzi-lo
Responsável: —

## Intenção

Na Central pública, o carregamento do vídeo só acontece depois do play. Isso é bom para quem está numa conexão lenta, mas deixa o card sem uma pista visual quando a pessoa ainda está escolhendo o que vale assistir.

Este item quer uma imagem leve e estática para cada peça de vídeo que já tem arquivo no acervo da Central. A pessoa deve reconhecer a peça antes de apertar play, sem buscar o arquivo de vídeo antecipadamente.

## Persona e fluxo

- **Persona / contexto:** visitante da campanha no celular ou desktop, folheando peças para escolher material para assistir e compartilhar.
- **Job principal:** distinguir vídeos pelo que aparece na tela e decidir qual deles quer reproduzir, sem abrir vários players.
- **Fluxo desejado:** abre `/conteudos` → vê o frame estático, o botão de play e os metadados → toca em play quando escolher → o vídeo carrega naquele momento.
- **Anti-goals de produto:** não transformar a Central em galeria pesada, não carregar todos os vídeos, não criar player ou tela de edição, não baixar mídia de terceiro e não misturar esta fatia com o acervo de falas.

### Esboço de fluxo (B)

```text
[/conteudos]
  → card de vídeo com arquivo
  → frame estático + play + título/metadados
  → a pessoa reconhece a peça e decide
  → toca no play
  → somente esse vídeo é buscado e reproduzido
  → sem frame disponível: slot neutro + play honesto
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-preview-frame-video-ui-design.html` — cenas desktop e mobile do card antes do play, fallback neutro e contraste entre frame e player durante a reprodução.

## Objetivo e aceite

- Toda peça de vídeo publicada e com arquivo no acervo exibe pelo menos um frame estático no catálogo público antes do play.
- O frame é uma pista visual leve: não promete representar um momento específico, não substitui o arquivo e não altera a reprodução.
- A peça não busca o arquivo de vídeo antes do play. O frame pode ser carregado como imagem, mas não deve puxar o vídeo nem o áudio.
- Se o frame não puder ser produzido, o card mantém um estado neutro com play e não mostra imagem quebrada nem tenta repetir a busca sem limite.
- Peça-link de YouTube ou Instagram, áudio, foto, texto e card mantêm o comportamento atual; esta entrega não promete frame local para uma peça que não tem arquivo.
- O kill switch continua valendo: uma peça despublicada não expõe sua mídia privada pelo novo preview.
- A lista interna `/campanha/comunicacao/conteudos` não ganha player nem uma segunda visualização de frame; a lista pública é o alvo obrigatório.

## Dados (intenção)

- **Vou apresentar dados?** Não — não há número, série, ranking ou métrica. O frame serve para reconhecimento visual.
- **Decisões desbloqueadas:** a pessoa escolhe qual vídeo reproduzir pela imagem; a equipe de conteúdo não precisa abrir cada peça para descobrir a cena.
- **Forma:** _adiada ao plano de implementação_ — nenhuma tabela, gráfico ou contador; a restrição é uma imagem leve e estática.

## Dados da decisão (literais)

- Identificador: `C226`.
- Rota pública: `/conteudos`.
- Regra visual: **pelo menos um frame estático por peça de vídeo com arquivo**.
- Regra de carregamento: **nenhum request do arquivo de vídeo antes do play**.
- Regra de falha: **fallback neutro sem imagem quebrada**.
- Peças com `sourceUrl` e sem arquivo local continuam peça-link; thumbnail remoto de plataforma não conta como frame do arquivo nesta fatia.
- O frame é uma pista de reconhecimento, não uma escolha editorial obrigatória nem um novo arquivo para baixar.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/conteudos/ContentPieceMedia.tsx` e `ContentPieceCard.tsx` para o slot de mídia; `src/lib/contentPieceCatalog.ts` e `src/utilities/content/contentPieceReads.ts` para a projeção pública; `src/collections/ContentMedia.ts`, `src/collections/ContentPiece.ts` e o processamento de `src/utilities/content/contentPieceJob.ts` para a origem do arquivo. A forma de gerar, guardar e invalidar o frame fica para o plano de implementação.
- **Precedente a olhar:** o contrato lazy do S27 em `docs/plans/central-conteudos-publica.md:44-66`; a separação entre arquivo e peça-link em `docs/plans/central-conteudos-ingestao.md:42-51` e `central-conteudos-link-instagram.md:47-60`; a política de mídia privada já documentada em `ContentMedia.ts`.
- **Risco de acoplamento:** `ContentPieceMedia` também é usado em outras superfícies públicas. O executor deve preservar o play sob demanda, o kill switch e a separação entre arquivo privado e peça-link; não deve reusar nem alterar o preview do acervo de falas C182.

## Dependências

- C211 — pipeline e acervo de peças com arquivo.
- S27 — catálogo público, filtro e contrato de reprodução sob demanda.
- C193/C199 e C220 — soft: preservam a política de mídia privada e a distinção entre arquivo oficial e link.

## Fora de escopo

- Preview do acervo de falas em `/campanha/comunicacao/acervo` e o frame do C182.
- Player, autoplay, hover-play, preview em movimento, editor de timestamp, seleção editorial ou recorte de vídeo.
- Download, persistência ou thumbnail de mídia de terceiros; peça-link continua circulando pelo link.
- Backfill/reprocessamento em massa, nova tela de ingestão, nova analytics, Consent ou alteração do kill switch.
- Mudança na lista interna de comunicação, no estúdio de cards ou no shell da Central.

## Rabbit holes de produto

- **Gerar frame para tudo.** Se alguém “só completar”, o item vira fila, backfill, armazenamento e reconciliação de todos os vídeos. **Corte neste item:** peças de vídeo com arquivo no acervo; a forma de geração fica no impl-plan.
- **Usar thumbnail de plataforma como se fosse frame local.** Isso mistura uma origem externa com um arquivo oficial e promete uma imagem que não pertence à peça. **Corte:** peça-link não recebe frame local nesta fatia.
- **Fazer o vídeo carregar junto da imagem para ficar mais rápido.** Isso desfaz o ganho do carregamento sob demanda. **Corte:** imagem antes, arquivo apenas depois do play.
- **Abrir um editor de frame.** Escolher timestamp, cortar imagem e revisar tudo vira trabalho de produção. **Corte:** um frame automático ou o fallback neutro.

## Questões em aberto (produto)

- **Qual frame usar quando o vídeo é elegível?** **Opções:** A) primeiro frame decodificável | B) frame representativo escolhido por uma regra determinística, como uma fração da duração | C) seleção manual pela assessoria. **Recomendação:** A — atende ao pedido com uma decisão simples e evita fingir que existe um momento editorial escolhido. _(assumido — validar no gate)_
- **O que fazer quando a extração falhar?** **Opções:** A) fallback neutro com play | B) thumbnail de uma plataforma externa | C) esconder o card. **Recomendação:** A — o card continua honesto e não inventa uma origem. _(assumido — validar no gate)_
- **O preview precisa aparecer também na página individual?** **Opções:** A) tornar obrigatório também na página da peça | B) validar apenas o catálogo nesta fatia. **Recomendação:** B — o relato é sobre o catálogo; qualquer efeito em uma superfície compartilhada será avaliado sem criar um segundo outcome. _(assumido — validar no gate)_

## Referências

- `docs/plans/central-conteudos-publica.md:40-80` — S27, rota, slot de mídia e play sob demanda.
- `docs/plans/central-conteudos-ingestao.md:42-76` — C211, arquivo versus peça-link e processamento.
- `docs/plans/central-conteudos-link-instagram.md:40-67` — C220, mídia oficial e limites de terceiro.
- `src/components/conteudos/ContentPieceMedia.tsx:147-196` — estado atual de vídeo antes do play.
- `src/components/conteudos/ContentPieceCard.tsx:132-144` — slot de mídia do card público.
- `src/lib/contentPieceCatalog.ts:655-739` — projeção pública do arquivo e distinção `isLink`.
- `src/collections/ContentMedia.ts:1-45` — dono atual do arquivo privado.
- `AGENTS.md` e `AGENTS-public.md` — convenções de mídia, UI pública e limites de produto.

## Self-score (shaping)

**5/5** — (1) a fatia tem um outcome verificável: frame antes do play para vídeo com arquivo; (2) o apetite declarado comporta a geração, a projeção e o fallback sem abrir uma fila editorial; (3) persona, job e aceite estão em linguagem de produto; (4) a direção no codebase é hipótese; (5) não há assinatura, migration, schema ou estratégia de armazenamento decidida no plano.
