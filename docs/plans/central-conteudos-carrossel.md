# C240 — Central de Conteúdos — carrossel do Instagram como conteúdo de primeira classe

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1399
Priority: P1
Impeccable: C — encaixe nas telas existentes (ficha interna C211 + catálogo/página pública S27), com um componente novo (galeria multi-mídia)
Design UI: docs/plans/central-conteudos-carrossel-ui-design.html
Appetite: ~3–4 dias eng; um outcome verificável
Responsável: —

## Intenção

O carrossel é o formato mais frequente do perfil oficial e hoje entra na Central pela porta dos fundos: vira "peça-link com motivo" e a ficha o apresenta como limitação ("Carrossel: sem arquivo único para baixar"), sem mídia alguma. A decisão original do C220 foi consciente ("carrossel não vira álbum"), mas o dono a reabriu em 2026-09-29 com evidência de produto nova: o carrossel deve ser **conteúdo de primeira classe** — a plataforma baixa automaticamente todas as mídias (imagens e vídeos) dos filhos pela API oficial do próprio perfil, transcreve/cataloga os vídeos como nas demais peças, e o público vê uma **galeria com Baixar (cada mídia) e Compartilhar** (post oficial). Há 50 carrosséis na janela de 60 dias do perfil e a esteira de importação está prestes a trazê-los; sem este item eles nascem incompletos e a assessoria aprende a ler conteúdo legítimo como erro.

**Decisão de produto registrada (reabre anti-goal do C220):** baixar os filhos do carrossel pela via oficial é permitido e desejado; a mídia da plataforma passa a ter casa na Central como as demais peças. Nada de scraping/terceiro — segue o caminho oficial do C212/C220.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`; `coordinator`/`candidate` também) importando o perfil e publicando peças; eleitor que consome e repassa o conteúdo na Central pública.
- **Job principal:** importar um carrossel e recebê-lo completo (todas as mídias), catalogado e pronto para publicar; eleitor: ver a galeria, baixar e compartilhar.
- **Fluxo desejado:** importa do perfil / cola o link → as mídias do carrossel são baixadas automaticamente, os vídeos transcritos e a peça catalogada → a ficha interna mostra "Carrossel" com suas mídias (não uma falha) → publica → o eleitor vê a galeria e usa Baixar (cada mídia) e Compartilhar (post oficial).
- **Anti-goals de produto:** não baixar mídia de terceiro (permanente); não exigir anexo manual (a promessa é automático); não publicar automaticamente; não criar segundo modelo de conteúdo/segunda peça; não virar galeria de vaidade com player/slideshow próprio do Instagram.

### Esboço de fluxo (C)

```text
[Importar do perfil / Adicionar por link] → carrossel reconhecido como "Carrossel"
  → API oficial entrega os filhos (media_type + media_url): imagens e vídeos baixados automaticamente
  → vídeos dos filhos entram na transcrição; peça catalogada (título, descrição, temas, cidade)
  → ficha interna: identidade Carrossel + galeria das mídias; sem caixa de falha
  → publicação → catálogo e página pública: galeria + Baixar (cada mídia) + Compartilhar (post oficial)
  → recibo da importação conta carrosséis como conteúdo trazido
[outcome: carrossel deixa de ser peça-link sem mídia e passa a ser conteúdo completo da Central]
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-carrossel-ui-design.html` (a produzir)

## Objetivo e aceite

- Um carrossel importado do perfil (ou adicionado por link) baixa automaticamente **todas** as mídias dos filhos pela API oficial, sem scraping e sem anexo manual.
- A peça do carrossel tem identidade própria ("Carrossel") na Central e nunca aparece com a linguagem de falha/limitação que existe hoje.
- Vídeos dentro do carrossel entram na transcrição/catálogo (busca por fala/tema consistente com as demais peças).
- Publicado, o carrossel aparece no catálogo e na página pública com galeria das mídias e ações **Baixar** (cada mídia) e **Compartilhar** (post oficial), mantendo o compartilhamento do link do Instagram.
- O recibo da importação conta o carrossel como conteúdo trazido (não como "peça-link com motivo").
- Peças de carrossel já criadas (importações anteriores / backfill) ganham o mesmo tratamento e mídias — nada fica preso no formato antigo.
- Guardrails: só o perfil próprio via API oficial (C212); mídia de terceiro nunca é baixada; nada é publicado automaticamente; curadoria e kill switch continuam por peça; sem PII nova.

## Dados (intenção)

- **Vou apresentar dados?** Não — apresentação de um tipo de conteúdo, não analytics (C213 segue dono da circulação).
- **Decisões desbloqueadas:** N/A — a decisão da assessoria é editorial ("publicar ou não o carrossel").
- **Forma:** N/A — sem números novos em tela.

## Dados da decisão (literais)

- Nome visível do tipo: **"Carrossel"** (sem sinônimo "álbum").
- Ações públicas do carrossel: **Baixar** (cada mídia da galeria) e **Compartilhar** (WhatsApp/link do post oficial) — além de **Copiar link** como nas demais peças.
- Recibo da importação: carrossel entra na contagem de conteúdo criado com o rótulo do tipo, e não no bloco de ressalvas de peça-link.
- Ficha interna: o motivo `carrossel` deixa de representar limitação; a peça lê como conteúdo completo.
- Transcrição: vídeos-filhos entram no mesmo pipeline de transcrição das demais peças.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/contentPiece.ts` (tipos/labels/razões), `src/utilities/content/contentPieceLink.ts` (resolução do link e download dos filhos), `src/utilities/content/contentPieceJob.ts` (processar N mídias; transcrever vídeos-filhos), `src/utilities/content/contentPieceCataloging.ts`, ficha interna `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/[id]/page.tsx`, catálogo/página pública `src/components/conteudos/` e `src/lib/contentPieceCatalog.ts`, rotas de mídia `src/app/(frontend)/conteudos/[slug]/`, recibo do importador `src/components/campaign/content/ImportContentPieceProfileDialog.tsx`.
- **Precedente a olhar:** o fluxo single-media do C211/C220/C230 (que este item generaliza), `MEDIA_FIELDS` com `children{media_type,media_url,thumbnail_url}` (já presente), a galeria/carrossel do site público (`src/components/CampaignCarousel.tsx`) como referência de linguagem, e a taxonomia `video|foto|texto|audio|card`.
- **Risco de acoplamento:** o modelo atual é uma mídia por peça (`contentPiece.media`) — a generalização para N mídias precisa preservar as peças existentes e as rotas públicas (`/conteudos/<slug>/midia`, frame, OG); `linkFailureReason` é lido por ficha, importador e testes (não quebrar `nao-encontrado`/`indisponivel`/`sem-credencial`); o S27 já renderiza peça-link — a entrega encaixa nele, sem segundo modelo.

## Dependências

- **Suaves:** C211 (peça/ficha), C220 (link→peça), C230 (importar do perfil), S27 (catálogo/página pública), C226 (frame) — todos entregues.
- **Relação com a operação de importação de 60 dias:** o backfill de 60 dias **já rodou** (2026-09-29) e criou **52 peças de carrossel** — 40 publicadas e 12 rascunhos — todas como peça-link sem arquivo; o aceite cobre o tratamento e as mídias dessas peças existentes.

## Fora de escopo

- Stories, destaques e demais formatos sem arquivo.
- Reprocessar carrosséis de terceiros (permanente).
- Player/slideshow próprio com reprodução automática ou embed do Instagram.
- Qualquer mudança no board/feed da home ou na circulação (C213).
- Download em pacote único (zip) — se pedido depois, item novo.

## Rabbit holes de produto

- **"Já que baixa os filhos, monta um álbum/zip".** Se alguém "só completar": pacote, álbum paralelo, storage duplicado. **Corte:** galeria com download por mídia; pacote é item futuro.
- **"Então cria um tipo novo para tudo que é link"** (YouTube, rádio). Se alguém "só completar": taxonomia paralela. **Corte:** o item trata o carrossel; os demais seguem como estão.
- **"Publica o carrossel automaticamente".** Se alguém "só completar": auto-publicação. **Corte:** curadoria continua humana.

## Questões em aberto (produto)

- **Ordem de execução na Central (galeria antes/depois da transcrição)?** **Opções:** A) peça publica quando as mídias estiverem prontas e o catálogo completa depois (como as demais) | B) segurar até transcrição concluir. **Recomendação:** A — mesmo contrato do C211 (job em background). _(assumido — validar com produto)_
- **Capa do carrossel no catálogo?** **Opções:** A) primeiro filho (comportamento atual do thumbnail) | B) escolha manual na ficha. **Recomendação:** A, com troca manual opcional se o picker já existir. _(assumido — validar com produto)_

## Referências

- GitHub Issue #— (após registro); design UI (gate): `docs/plans/central-conteudos-carrossel-ui-design.html`.
- Planos irmãos: `central-conteudos-ingestao.md` (C211) · `central-conteudos-link-instagram.md` (C220) · `central-conteudos-importar-perfil.md` (C230) · `central-conteudos-publica.md` (S27) · `central-conteudos-preview-frame-video.md` (C226).
- Arquivos-pista: `src/utilities/socialFeed/instagramFeed.ts:106-115` (MEDIA_FIELDS com children) · `src/utilities/content/contentPieceLink.ts:304-313` (ramo carrossel atual) · `src/lib/contentPiece.ts:355-379` (motivos) · `src/components/conteudos/ContentPieceDetail.tsx` · `src/components/conteudos/ContentPieceCard.tsx` · `src/components/campaign/content/ImportContentPieceProfileDialog.tsx:50-64` (recibo).
