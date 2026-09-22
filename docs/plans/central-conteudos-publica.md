# S27 — Central de Conteúdos pública — Peça voto pra Solla 1313

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1255
Priority: P1
Impeccable: C — fluxo público novo (`/conteudos` + página da peça)
Design UI: docs/plans/central-conteudos-publica-ui-design.html
Appetite: ~2–3 dias eng; a Central no ar com as peças de C211 filtráveis, cada peça com página própria e compartilhamento contextual de voto
Responsável: —

## Intenção

Estamos na reta final — 1º turno em 4 de outubro — e o maior cabo eleitoral de Solla é o próprio eleitor: quem já vota precisa pedir voto. Hoje o material (Reels, textos, fotos, jingles, cards) está espalhado entre grupo de WhatsApp, drive e redes, e quem quer ajudar não sabe onde pegar a peça certa nem o que escrever junto. Esta fatia cria a campanha "Peça voto pra Solla 1313" com uma casa para o material: a Central de Conteúdos. O eleitor chega, filtra pelo que faz sentido para a sua cidade/região/tema, vê e ouve a peça direto no catálogo (play sob demanda) e baixa ou compartilha dali mesmo no WhatsApp, com uma mensagem que já pede voto — contextualizada pela peça. Entre as peças, a criação do card personalizado aparece como uma peça do catálogo, que leva ao estúdio. A chamada e o CTA da tela têm um objetivo único: fazer o visitante pedir voto pro Solla 1313 — apelativos e verificáveis. E a Central não dispara nada: ela empodera o eleitor a fazer, no aparelho dele, o que a campanha não pode fazer em massa.

## Persona e fluxo

- **Persona / contexto:** eleitor/simpatizante/liderança no celular, com pressa, no meio da rotina; quer repassar material de Solla e não sabe o que escrever nem onde achar a peça certa.
- **Job principal:** pegar uma peça oficial de Solla e pedir voto pra ele no WhatsApp, sem trabalho e sem medo de errar.
- **Fluxo desejado:** abre `/conteudos` → vê "Peça voto pra Solla 1313 · Central de Conteúdos" → filtra por Tipo/Cidade/Região/Tema/Instituição ou busca por termo → vê a peça no próprio catálogo (vídeo/áudio só carrega ao tocar em play; foto com preview leve) → baixa ou compartilha dali mesmo (mensagem de voto sugerida, editável) → repassa; se quiser o card dele, toca na peça de card e cai no `/cards`.
- **Anti-goals de produto:** não vira rede social (sem comentários/likes/perfil); não vira editor de mídia nem segundo catálogo (quem cataloga é o interno, C211); não captura dado nem pede login; não dispara em massa (nada de WhatsApp Business API); não re-hospeda o que já tem dono (jingle/artigo/card).

### Esboço de fluxo (C)

```text
[eleitor no celular] → /conteudos ("Peça voto pra Solla 1313 · Central de Conteúdos")
→ filtra (Tipo · Cidade · Região · Tema · Instituição) e/ou busca por termo
→ vê/ouve a peça no catálogo (play sob demanda; foto com preview leve)
→ Baixar · Compartilhar (mensagem de voto no WhatsApp · a mídia · copiar link) dali mesmo
  · peça de Card → /cards (fazer o meu)
→ [eleitor edita e envia no próprio WhatsApp] → a peça circula
→ /conteudos/<slug> continua existindo para detalhes e para o link abrir bonito
[peça despublicada] → some da lista; link direto mostra estado honesto de indisponível
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-publica-ui-design.html` — classe C porque é fluxo público novo (catálogo filtrável com preview/ações + página da peça); o design hi-fi é obrigatório no gate. Revisão pedida no gate: layout mais limpo e copy focada em pedir voto.

## Objetivo e aceite

- O visitante abre `/conteudos` e vê as peças publicadas (as de C211), filtráveis por Tipo · Cidade · Região · Tema · Instituição e por termo de busca; os filtros combinam entre si.
- Cada peça tem página própria `/conteudos/<slug>` com preview (título + imagem) para o link abrir bem no WhatsApp.
- Preview no próprio catálogo: Vídeo e Áudio só carregam quando o eleitor toca em play (nada de baixar tudo de uma vez); Foto aparece com preview leve; as ações `Baixar` e `Compartilhar` (Mensagem no WhatsApp · A mídia · Copiar link) funcionam direto do card, sem precisar abrir a peça.
- A criação do card personalizado aparece no catálogo como uma peça (mesmo grid), que leva ao estúdio `/cards` para o eleitor fazer o dele.
- A chamada e o CTA da página pedem voto (apelativos, sem promessa irrealista) — o objetivo único da tela é o eleitor pedir voto pro Solla 1313.
- Ações por peça: `Baixar` · `Compartilhar` (opções: "Mensagem no WhatsApp" com a mensagem de voto sugerida e editável · "A mídia" · "Copiar link") · `Fazer meu card` (peça de Card → `/cards`).
- "A mídia": onde o aparelho permitir, abre a folha de compartilhamento nativa com o arquivo (o eleitor escolhe o WhatsApp); onde não houver, baixa — nunca fingir que anexou. `wa.me` não anexa arquivo; o link é sempre a alternativa que funciona em qualquer aparelho.
- Peça-link (Instagram/YouTube) compartilha pelo link da plataforma; peça com arquivo permite baixar e compartilhar pelo link da peça — sem segunda cópia.
- O compartilhamento é o eleitor no próprio aparelho: `wa.me/?text=`, sem destinatário e sem envio pelo sistema; a mensagem nunca sai sozinha.
- Mobile-first e leve: usável em conexão ruim, sem login e sem cadastro.
- **Kill switch:** despublicar uma peça a tira da Central e da própria página na hora; sem peça publicada, a Central mostra estado honesto e o link de descoberta some.
- **Guardrails:** LGPD — sem login, sem captura de dado, sem PII e sem rastreio neste item (analytics = C213); TSE — nenhuma promessa irrealista, identidade eleitoral visível (bloco obrigatório do rodapé preservado), nada de disparo em massa; cards seguem 100% no aparelho (a Central só convida para `/cards`); nenhuma mídia de terceiro baixada; o link do Instagram/YouTube da peça nunca deixa a Central parecer fonte oficial da plataforma.

## Dados (intenção)

- **Dados: N/A** — a Central não apresenta número, contador nem ranking; é superfície de peças. Quem mede circulação é C213 (fora de escopo).
- **Decisões desbloqueadas:** o eleitor decide o que baixar/compartilhar; a comunicação decide o que publicar/despublicar. Nenhum dado do visitante é coletado.

## Dados da decisão (literais)

- Nome na tela: `Central de Conteúdos`; chamada principal: `Peça voto pra Solla 1313` — chamada e CTA de pedido de voto, apelativos e verificáveis.
- URL (decidida no gate): lista `/conteudos`; peça `/conteudos/<slug>`; `conteudos` entra nos slugs reservados do site.
- Filtros (rótulos): `Tipo` · `Cidade` · `Região` · `Tema` · `Instituição`; mais campo de busca por termo (busca semântica é S28).
- Ações por peça (no card do catálogo e na página): `Baixar` · `Compartilhar` com as opções `Mensagem no WhatsApp` · `A mídia` · `Copiar link`; a peça de Card leva a `Fazer meu card` → `/cards`.
- Preview: Vídeo e Áudio com play sob demanda (a mídia só é buscada no toque, sem baixar tudo); Foto com preview leve; a página da peça continua existindo para detalhes e para o link abrir bonito.
- Mensagens de voto (assumidas — validar com a comunicação), sempre editáveis, com o sistema nunca enviando:
  - Vídeo → `Estamos na reta final e o Jorge Solla 1313 precisa do seu voto. Olha esse vídeo: <título> — <link>. Peça voto pra Solla 1313 pra quem você conhece.`
  - Áudio → `Ouça e mande pro grupo: <título> — <link>. Peça voto pra Solla 1313.`
  - Foto/Texto/Card → `Fiz/achei esse material do Solla 1313: <título> — <link>. Peça voto pra Solla 1313 também.`
- O sistema nunca envia: abre o WhatsApp com o texto pronto e o eleitor edita antes de mandar (`wa.me/?text=`, sem destinatário).
- Peça-link (Instagram/YouTube) compartilha pelo link; peça-arquivo permite `Baixar`, `A mídia` (folha nativa quando houver, senão download) e compartilhar pelo link da peça — sem re-hospedar cópia.
- Toda peça publicada tem página própria com preview `título + imagem` (OG) para o link abrir bem no WhatsApp.
- Kill switch por peça (publicado/despublicado) — despublicar tira na hora, sem apagar arquivo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova `src/app/(frontend)/conteudos/` (lista + `[slug]`); filtros/busca e card em `src/components/`; share reusando `src/lib/contentShare.ts`, `src/lib/phone.ts` (`buildWhatsAppTextShareUrl`), `ContentShareButton`/`CopyLinkButton` e o padrão de "copiar com feedback"; cache e revalidação no padrão de `src/utilities/documents.ts` + allowlist em `src/app/(frontend)/api/revalidate/route.ts`; descoberta em `src/components/CampaignFooter.tsx`/`SiteHeader.tsx`.
- **Precedente a olhar:** `/jingles` (página pública com kill switch + `<a download>`), `/corte/[id]` (página pública de peça + share kit), `ShareLink` (OG + `published` como kill switch), `CardsStudio` (`/cards` com deep-link `?model=`), S4 (`docs/plans/compartilhar-conteudos-home-whatsapp.md`).
- **Risco de acoplamento:** rota estática nova precisa entrar em `SHARE_LINK_RESERVED_SLUGS` (`src/lib/shareLink.ts`) senão o drift test falha; mídia pública baixa por atributo `download` (proxy `/api/media/file/...` sem `Content-Disposition`) — sem zip/lote; cards personalizáveis são canvas client-side (blob sem URL pública) → só convite para `/cards`; não existe precedente de filtro/busca pública (o maquinário de URL state é interno) — seguir o padrão do site, sem importar o interno; a folha nativa de compartilhamento com arquivo (`navigator.share`) é suportada só em parte dos aparelhos — sempre com fallback de download; o preview de vídeo/áudio no catálogo exige carregamento sob demanda (poster + play) para a página não pesar.

## Dependências

- **C211** (peças catalogadas e publicadas pelo interno) — dura: sem catálogo publicado não há Central.
- Design hi-fi aprovado no gate.

## Fora de escopo

- Busca semântica (S28) — aqui é busca por termo.
- Analytics, contadores, UTM e qualquer rastreio do visitante (C213).
- Editar/subir mídia pela Central (é C211); comentários/likes/perfil; app de disparo ou integração com WhatsApp Business API.
- Segunda cópia de arquivo (re-hospedar jingle/artigo/card); download em zip/lote.
- Página de bandeira/SEO §7.2 (`docs/campanha/plano-site-campanha-2026.md` §7.2) — peça não vira landing de bandeira; redesign do shell/nav/home.

## Rabbit holes de produto

- **Uma tela por tipo de mídia.** Se alguém "só completar": player de áudio, lightbox de foto, embed de IG, cada tipo com layout próprio. **Corte neste item:** um board único com card por peça; tipo é dado do filtro, não tela.
- **Catálogo virar cabine de mídia.** Se alguém "só completar": carregar todos os vídeos/áudios na abertura, autoplay, player próprio. **Corte neste item:** play sob demanda (a mídia só carrega no toque) e nenhum recurso além de dar play/ouvir.
- **A Central virar rede social.** Se alguém "só completar": curtir, comentar, salvar, perfil, feed. **Corte:** nada de UGC/engajamento — só encontrar, baixar e repassar.
- **Re-hospedar o acervo inteiro.** Se alguém "só completar": subir jingle/artigo/card em cópia própria na Central. **Corte:** a Central referencia o dono; só a peça que nasce nela ganha arquivo.
- **Disparo em massa "para ajudar".** Se alguém "só completar": lista, agendamento, API Business. **Corte:** `wa.me` do eleitor, sem destinatário — vedação TSE.
- **Personalizador embutido na Central.** Se alguém "só completar": renderizar o card no servidor para "baixar pronto". **Corte:** a peça de card leva a `/cards`; o card do eleitor segue 100% no aparelho.

## Questões em aberto (produto)

- **URL `/conteudos` + `/conteudos/<slug>`?** **Decidido no gate:** A — lista e peça no mesmo namespace; entra em `SHARE_LINK_RESERVED_SLUGS`. _(decidido)_
- **Chamada/CTA da página?** **Decidido no gate:** foco em pedir voto ("Peça voto pra Solla 1313"), apelativo e verificável; a copy final passa pela comunicação. _(decidido)_
- **Mensagem sugerida por tipo?** **Opções:** A) os 3 templates (Vídeo/Áudio/Foto-Texto-Card) dos literais | B) um template único | C) só o link, sem sugestão. **Recomendação:** A — é o pedido do dono; sempre editável antes de enviar. _(assumido — validar com a comunicação)_
- **Como a mídia circula?** **Opções:** A) peça-link compartilha pelo link da plataforma; peça-arquivo oferece "A mídia" (folha nativa com o arquivo, quando suportada) e `Baixar` como fallback | B) tudo pelo link da peça | C) só baixar e o eleitor anexa. **Recomendação:** A — é o pedido do dono (compartilhar a mídia diretamente), com fallback honesto onde o aparelho não suportar; `wa.me` não anexa arquivo. _(assumido)_
- **Filtros v1?** **Opções:** A) os 5 rótulos + busca por termo | B) só `Tipo` + `Cidade` + busca | C) só busca. **Recomendação:** A, exibindo apenas filtro que tenha valor entre as peças publicadas. _(assumido — validar com produto)_

## Referências

- Design UI (gate): `docs/plans/central-conteudos-publica-ui-design.html` (+ assets em `central-conteudos-publica-ui-design-assets/`)
- Planos irmãos: `docs/plans/central-conteudos-ingestao.md` (C211 — o catálogo que alimenta a página), `docs/plans/compartilhar-conteudos-home-whatsapp.md` (S4 — wa.me do remetente, sem telemetria), `docs/plans/links-compartilhamento-miniatura-og.md` (S19), `docs/plans/cards-personalizados-campanha.md` (S13), `docs/plans/corte-pagina-publica-design.md` (C167).
- Arquivos-pista: `src/lib/contentShare.ts`, `src/components/ContentShareButton.tsx`, `src/lib/phone.ts`, `src/lib/shareLink.ts`, `src/components/jingles/JingleCards.tsx`, `src/components/cards/CardsStudio.tsx`, `src/components/CampaignFooter.tsx`, `src/utilities/documents.ts`, `src/app/(frontend)/api/revalidate/route.ts`.
- `AGENTS-public.md` — convenções do site público; `docs/campanha/plano-site-campanha-2026.md` §7.1 (compartilhamento por seção — ideia do cliente).

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (Central no ar com peças filtráveis e compartilhamento de voto); (2) appetite ~2–3 dias cabe com design hi-fi + port; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia.
