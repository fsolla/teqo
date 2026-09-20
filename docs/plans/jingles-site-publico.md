# Jingles de Jorge Solla no site público — ouvir e baixar (S21)

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1222
Priority: P2
Impeccable: D — superfície nova no site público (página de jingles)
Design UI: docs/plans/jingles-site-publico-ui-design.html
Appetite: ~1–1,5 dia eng; uma página nova com os jingles tocáveis e baixáveis
Responsável: —

## Intenção

O mandato tem jingles — peças que a militância e o eleitor já reconhecem — e não há onde ouvi-los ou pegá-los no site. Quem procura cai em link solto de YouTube/WhatsApp, sem uma casa oficial. Esta fatia abre uma seção no site público onde o visitante **ouve o jingle ali mesmo** (player com a capa) e **baixa o arquivo** para usar no grupo, no carro, no evento. É a vitrine sonora da pré-campanha: simples, bonita e fácil de repassar. Nasce pequena de propósito — 3 jingles, uma página, sem loja e sem discografia.

## Persona e fluxo

- **Persona / contexto:** eleitor/militante/liderança que recebe o link no WhatsApp, no celular, com pressa; secundariamente a assessoria, que precisa do arquivo para um evento.
- **Job principal:** ouvir o jingle oficial e baixá-lo na hora, sem intermediário e sem cadastro.
- **Fluxo desejado:** chega (rodapé, link ou busca) → vê os jingles com capa → dá play sem sair da página → troca/pausa → baixa o MP3 → repassa.
- **Anti-goals de produto:** não vira loja/streaming; não captura dados nem pede consent; não vira discografia com páginas por música; não promete lançamentos.

### Esboço de fluxo (D)

```text
[visitante (rodapé / link no WhatsApp / busca)] → /jingles
→ título da seção + jingles com capa e play
→ ouve (um por vez: tocar um para o anterior) · pausa · troca
→ Baixar (MP3)
→ [nada publicado] → estado honesto na página e link some do rodapé
```

### Design UI (D)

- Design UI (gate): `docs/plans/jingles-site-publico-ui-design.html` (+ assets em `docs/plans/jingles-site-publico-ui-design-assets/`)

## Objetivo e aceite

- A página `/jingles` lista os jingles publicados com capa, título e player; toca sem sair da página e sem abrir terceiros.
- Cada jingle tem download direto em MP3, com nome de arquivo legível; baixar não depende de estar tocando.
- Um jingle por vez: iniciar um para o que estiver tocando (polimento de UX, não controle novo).
- **Kill switch:** cada jingle e a página inteira saem do ar por despublicação, sem apagar arquivo; despublicado não aparece em lugar nenhum (fail-closed). Sem nada publicado, a página não é descoberta e o acesso direto mostra estado honesto.
- Leveza no celular: abrir a página não baixa os áudios; capas otimizadas; utilizável em conexão ruim.
- Página pública indexável, com título/descrição próprios (o oposto de `/corte/<id>`, que é não listada).
- LGPD: N/A — sem formulário, sem consent, sem PII nesta tela.
- Descoberta por link no rodapé; home e navegação principal intocadas nesta fatia.

## Dados (intenção)

- **Vou apresentar dados?** Não — superfície de mídia (áudio + capa); nenhuma PII coletada.
- **Decisões desbloqueadas:** N/A — a decisão é do visitante (ouvir/baixar/repassar), não uma leitura de números.
- **Forma:** N/A — sem dado agregado a definir.

## Dados da decisão (literais)

- ID `S21`; slug `jingles-site-publico`; tipo `feature`; Priority `P2`; Impeccable `D`.
- Rota proposta (hipótese do gate): `/jingles`.
- Design UI (gate): `docs/plans/jingles-site-publico-ui-design.html` + assets em `docs/plans/jingles-site-publico-ui-design-assets/`.
- Fonte conferida no disco (`/home/fsolla/Downloads/Jingles/`): `Jorge Solla 1313 - Axé.mp3` (5,4MB) + capa `Jorge Solla 1313 - Axé.png` (2,8MB); `Jorge Solla 1313 - Forró.wav` (53,2MB) + capa `Jorge Solla 1313 - Forró.jpeg` (1,1MB); `Jorge Solla 1313 - Pagodão.wav` (36,8MB) + capa `Jorge Solla 1313 - Pagodão.png` (2,8MB).
- Decisão assumida: um MP3 por jingle serve para tocar e baixar; **WAV não vai ao site** (converter os WAV ou obter MP3 oficiais).
- Títulos exibidos: `Axé`, `Forró`, `Pagodão` (sufixo completo "Jorge Solla 1313 – …" a confirmar no gate).
- LGPD: N/A — sem coleta e sem consent.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova em `src/app/(frontend)/`; lista/player em `src/components/`; áudio e capa entrando pela mídia existente; link de descoberta em `src/components/CampaignFooter.tsx`; cache público no padrão dos conteúdos.
- **Precedente a olhar:** `/corte/[id]` (`src/app/(frontend)/corte/[id]/page.tsx` — player; `src/components/SpeechCutShareActions.tsx:50-61` — download) e a listagem/cache de `src/utilities/posts.ts`.
- **Risco de acoplamento:** assets grandes nunca em `public/` (a pasta vai para a imagem Docker) — áudio/capa entram pela mídia (S3/Garage em produção, disco em dev); não criar segundo cadastro de pessoa; Consent intocado.

## Dependências

- MP3 dos três jingles (converter os WAV ou pedir os oficiais) — comunicação/design.
- Design hi-fi aprovado no gate.
- Nenhuma dura de código.

## Fora de escopo

- Loja/streaming externo, embed de Spotify/YouTube, botão "ouvir no…".
- Analytics de play, contagem de downloads, captura de dados/consent (LGPD: N/A).
- Compartilhamento social nativo dos jingles (share kit) — item futuro se pedido.
- Edição/trim de áudio, letras, playlists, destaques.
- Redesign do shell/nav/home; seção na home; página por jingle ou álbum.
- CDN própria e conversão de acervo além dos 3 jingles.

## Rabbit holes de produto

- **Player rico (ondas/equalizador/análise).** Se alguém “só completar”: vira projeto de player custom e atrasa a entrega. **Corte neste item:** player simples com capa; bonito pelo layout, não pelo visualizador.
- **Subir os WAV originais.** Se alguém “só completar”: ~90MB de áudio pesando no celular e no compartilhamento. **Corte:** um MP3 por jingle; WAV fica só como fonte local.
- **Discografia com páginas por jingle/álbum.** Se alguém “só completar”: metadados, datas, letras, N páginas para manter. **Corte:** uma página com os 3.
- **CDN própria / converter todo o acervo.** Se alguém “só completar”: infra de mídia nova. **Corte:** mídia e hospedagem existentes.

## Questões em aberto (produto)

- **Formato dos arquivos?** **Opções:** A) um MP3 por jingle (toca e baixa), convertendo os WAV ou pedindo oficiais | B) WAV para download + MP3 para ouvir | C) subir os WAV como estão. **Recomendação:** A — um arquivo serve aos dois usos, leve no celular e no WhatsApp. _(assumido — validar no gate)_
- **Onde a seção vive?** **Opções:** A) página dedicada `/jingles` com link de descoberta no rodapé | B) só uma seção na home | C) ambos. **Recomendação:** A — indexável e linkável, sem inflar a home nesta fatia. _(assumido)_
- **Quem mantém o conteúdo?** **Opções:** A) gerenciável no CMS (comunicação sobe, troca capa/áudio e tira do ar sem deploy) | B) arquivos estáticos no repositório (troca = deploy). **Recomendação:** A — o site é CMS-first; operação vira comunicação, não engenharia.
- **Quem pode desligar a seção e como?** **Opções:** A) despublicar cada jingle e a página inteira, sem apagar arquivo | B) só por item | C) remoção por deploy. **Recomendação:** A — mesmo espírito do conteúdo eleitoral que sai do ar por decisão de comunicação/jurídico.

## Referências

- GitHub Issue #1222
- Design UI (gate): `docs/plans/jingles-site-publico-ui-design.html` (+ `jingles-site-publico-ui-design-assets/`)
- Arquivos-fonte dos jingles: `/home/fsolla/Downloads/Jingles/`
- Precedente de página pública com player + download: `docs/plans/corte-pagina-publica-design.md`; `src/app/(frontend)/corte/[id]/page.tsx`
- `src/collections/Media.ts` — upload/leitura pública de mídia
- `src/components/CampaignFooter.tsx` — links de descoberta do rodapé
- `AGENTS.md` — mídia/S3, convenções do site público
